import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommandHandler } from "../src/commands.js";
import type { HAWebSocketClient } from "../src/websocket.js";
import type { StateTracker } from "../src/state.js";
import type { OpencodeClient } from "@opencode-ai/sdk";

// Mock notify module
vi.mock("../src/notify.js", () => ({
  notify: vi.fn(),
}));

describe("CommandHandler", () => {
  let mockWsClient: HAWebSocketClient;
  let mockState: StateTracker;
  let mockClient: OpencodeClient;
  let handler: CommandHandler;
  let commandCallback: (command: string, sessionId: string, data: Record<string, unknown>) => void;
  let stateRequestCallback: () => void;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock WebSocket client
    mockWsClient = {
      onCommand: vi.fn((cb) => { commandCallback = cb; }),
      onStateRequest: vi.fn((cb) => { stateRequestCallback = cb; }),
      sendStateResponse: vi.fn().mockResolvedValue(undefined),
    } as unknown as HAWebSocketClient;

    // Mock StateTracker
    mockState = {
      getCurrentSessionId: vi.fn().mockReturnValue("ses_123"),
      getPendingPermission: vi.fn().mockReturnValue(null),
      clearPermission: vi.fn().mockResolvedValue(undefined),
      getAllSessions: vi.fn().mockReturnValue([
        { session_id: "ses_123", state: "idle", title: "Test Session" },
      ]),
    } as unknown as StateTracker;

    // Mock OpenCode client
    mockClient = {
      session: {
        get: vi.fn().mockResolvedValue({
          data: { title: "Test Session" },
        }),
        messages: vi.fn().mockResolvedValue({
          data: [],
        }),
        prompt: vi.fn().mockResolvedValue({}),
      },
      app: {
        agents: vi.fn().mockResolvedValue({
          data: [{ name: "code", mode: "primary" }],
        }),
      },
      postSessionIdPermissionsPermissionId: vi.fn().mockResolvedValue({}),
    } as unknown as OpencodeClient;

    handler = new CommandHandler(mockWsClient, mockState, mockClient, "test-token");
  });

  describe("start", () => {
    it("should register command and state request handlers", () => {
      handler.start();

      expect(mockWsClient.onCommand).toHaveBeenCalled();
      expect(mockWsClient.onStateRequest).toHaveBeenCalled();
    });
  });

  describe("state request handling", () => {
    it("should send state response on state request", async () => {
      handler.start();
      
      // Trigger state request
      stateRequestCallback();

      // Allow async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWsClient.sendStateResponse).toHaveBeenCalledWith(
        "test-token",
        expect.any(Array)
      );
    });
  });

  describe("send_prompt command", () => {
    it("should send prompt to current session", async () => {
      handler.start();

      commandCallback("send_prompt", "ses_123", { text: "Hello world" });

      // Allow async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockClient.session.prompt).toHaveBeenCalledWith({
        path: { id: "ses_123" },
        body: {
          agent: undefined,
          parts: [{ type: "text", text: "Hello world" }],
        },
      });
    });

    it("should use provided agent", async () => {
      handler.start();

      commandCallback("send_prompt", "ses_123", { text: "Build the app", agent: "build" });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockClient.session.prompt).toHaveBeenCalledWith({
        path: { id: "ses_123" },
        body: {
          agent: "build",
          parts: [{ type: "text", text: "Build the app" }],
        },
      });
    });

    it("should use current session if no session_id provided", async () => {
      handler.start();

      commandCallback("send_prompt", "", { text: "Hello" });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockClient.session.prompt).toHaveBeenCalledWith({
        path: { id: "ses_123" },
        body: expect.any(Object),
      });
    });
  });

  describe("respond_permission command", () => {
    beforeEach(() => {
      // Set up pending permission
      (mockState.getPendingPermission as ReturnType<typeof vi.fn>).mockReturnValue({
        id: "perm_1",
        type: "file",
        title: "Read file",
        session_id: "ses_123",
        message_id: "msg_1",
      });
    });

    it("should send permission response (once)", async () => {
      handler.start();

      commandCallback("respond_permission", "ses_123", {
        permission_id: "perm_1",
        response: "once",
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockClient.postSessionIdPermissionsPermissionId).toHaveBeenCalledWith({
        path: { id: "ses_123", permissionID: "perm_1" },
        body: { response: "once" },
      });
    });

    it("should send permission response (always)", async () => {
      handler.start();

      commandCallback("respond_permission", "ses_123", {
        permission_id: "perm_1",
        response: "always",
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockClient.postSessionIdPermissionsPermissionId).toHaveBeenCalledWith({
        path: { id: "ses_123", permissionID: "perm_1" },
        body: { response: "always" },
      });
    });

    it("should send permission response (reject)", async () => {
      handler.start();

      commandCallback("respond_permission", "ses_123", {
        permission_id: "perm_1",
        response: "reject",
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockClient.postSessionIdPermissionsPermissionId).toHaveBeenCalledWith({
        path: { id: "ses_123", permissionID: "perm_1" },
        body: { response: "reject" },
      });
    });

    it("should clear permission after successful response", async () => {
      handler.start();

      commandCallback("respond_permission", "ses_123", {
        permission_id: "perm_1",
        response: "once",
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockState.clearPermission).toHaveBeenCalled();
    });

    it("should not respond when no pending permission", async () => {
      (mockState.getPendingPermission as ReturnType<typeof vi.fn>).mockReturnValue(null);
      
      handler.start();

      commandCallback("respond_permission", "ses_123", {
        permission_id: "perm_1",
        response: "once",
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockClient.postSessionIdPermissionsPermissionId).not.toHaveBeenCalled();
    });
  });

  describe("get_history command", () => {
    it("should fetch history for session", async () => {
      handler.start();

      commandCallback("get_history", "ses_123", {});

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockClient.session.get).toHaveBeenCalledWith({
        path: { id: "ses_123" },
      });
      expect(mockClient.session.messages).toHaveBeenCalledWith({
        path: { id: "ses_123" },
      });
    });
  });

  describe("get_agents command", () => {
    it("should fetch agents", async () => {
      handler.start();

      commandCallback("get_agents", "", {});

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockClient.app.agents).toHaveBeenCalled();
    });
  });
});
