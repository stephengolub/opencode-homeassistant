import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { CommandHandler } from "../src/commands.js";
import type { Discovery } from "../src/discovery.js";
import type { StateTracker } from "../src/state.js";
import type { MqttWrapper } from "../src/mqtt.js";
import type { OpencodeClient } from "@opencode-ai/sdk";

// Mock notify module
vi.mock("../src/notify.js", () => ({
  notify: vi.fn(),
}));

// Mock MQTT
function createMockMqtt(): MqttWrapper {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as MqttWrapper;
}

// Mock Discovery
function createMockDiscovery(): Discovery {
  return {
    deviceId: "opencode_test",
    getCommandTopic: vi.fn(() => "opencode/opencode_test/command"),
    getResponseTopic: vi.fn(() => "opencode/opencode_test/response"),
  } as unknown as Discovery;
}

// Mock StateTracker
function createMockState(options?: {
  sessionId?: string | null;
  pendingPermission?: {
    id: string;
    type: string;
    title: string;
    sessionID: string;
    messageID: string;
  } | null;
}): StateTracker {
  return {
    getCurrentSessionId: vi.fn(() => options?.sessionId ?? null),
    getPendingPermission: vi.fn(() => options?.pendingPermission ?? null),
    clearPermission: vi.fn().mockResolvedValue(undefined),
  } as unknown as StateTracker;
}

// Mock OpenCode client
function createMockClient(): OpencodeClient {
  return {
    session: {
      get: vi.fn().mockResolvedValue({
        data: { title: "Test Session" },
      }),
      messages: vi.fn().mockResolvedValue({
        data: [],
      }),
      prompt: vi.fn().mockResolvedValue({}),
    },
    postSessionIdPermissionsPermissionId: vi.fn().mockResolvedValue({}),
  } as unknown as OpencodeClient;
}

describe("CommandHandler", () => {
  let mqtt: MqttWrapper;
  let discovery: Discovery;
  let state: StateTracker;
  let client: OpencodeClient;
  let handler: CommandHandler;
  let messageCallback: (topic: string, payload: string) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mqtt = createMockMqtt();
    discovery = createMockDiscovery();
    state = createMockState({ sessionId: "session-1" });
    client = createMockClient();
    handler = new CommandHandler(mqtt, discovery, state, client);

    // Capture the subscribe callback
    (mqtt.subscribe as Mock).mockImplementation((_topic: string, cb: (topic: string, payload: string) => void) => {
      messageCallback = cb;
      return Promise.resolve();
    });
  });

  describe("start", () => {
    it("should subscribe to command topic", async () => {
      await handler.start();

      expect(mqtt.subscribe).toHaveBeenCalledWith(
        "opencode/opencode_test/command",
        expect.any(Function)
      );
    });
  });

  describe("message parsing", () => {
    beforeEach(async () => {
      await handler.start();
    });

    it("should reject invalid JSON", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      messageCallback("opencode/opencode_test/command", "not json");

      expect(consoleSpy).toHaveBeenCalledWith(
        "[ha-opencode] Invalid command JSON:",
        "not json"
      );
      consoleSpy.mockRestore();
    });

    it("should reject missing command field", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      messageCallback("opencode/opencode_test/command", '{"foo": "bar"}');

      expect(consoleSpy).toHaveBeenCalledWith(
        "[ha-opencode] Command missing 'command' field:",
        '{"foo": "bar"}'
      );
      consoleSpy.mockRestore();
    });
  });

  describe("prompt command", () => {
    beforeEach(async () => {
      await handler.start();
    });

    it("should send prompt to current session", async () => {
      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({ command: "prompt", text: "Hello world" })
      );

      // Wait for async processing
      await vi.waitFor(() => {
        expect(client.session.prompt).toHaveBeenCalledWith({
          path: { id: "session-1" },
          body: {
            parts: [{ type: "text", text: "Hello world" }],
          },
        });
      });
    });

    it("should use provided session_id", async () => {
      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({
          command: "prompt",
          text: "Hello",
          session_id: "custom-session",
        })
      );

      await vi.waitFor(() => {
        expect(client.session.prompt).toHaveBeenCalledWith({
          path: { id: "custom-session" },
          body: {
            parts: [{ type: "text", text: "Hello" }],
          },
        });
      });
    });

    it("should reject empty prompt text", async () => {
      const { notify } = await import("../src/notify.js");

      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({ command: "prompt", text: "" })
      );

      await vi.waitFor(() => {
        expect(notify).toHaveBeenCalledWith("Prompt Error", "Empty prompt text");
      });
      expect(client.session.prompt).not.toHaveBeenCalled();
    });

    it("should reject prompt when no active session", async () => {
      // Recreate with no session
      state = createMockState({ sessionId: null });
      handler = new CommandHandler(mqtt, discovery, state, client);
      await handler.start();

      const { notify } = await import("../src/notify.js");

      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({ command: "prompt", text: "Hello" })
      );

      await vi.waitFor(() => {
        expect(notify).toHaveBeenCalledWith("Prompt Error", "No active session");
      });
    });
  });

  describe("permission_response command", () => {
    const pendingPermission = {
      id: "perm-123",
      type: "file_write",
      title: "Write to file.txt",
      sessionID: "session-1",
      messageID: "msg-1",
    };

    beforeEach(async () => {
      state = createMockState({ sessionId: "session-1", pendingPermission });
      handler = new CommandHandler(mqtt, discovery, state, client);
      await handler.start();
    });

    it("should send permission response (once)", async () => {
      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({
          command: "permission_response",
          permission_id: "perm-123",
          response: "once",
        })
      );

      await vi.waitFor(() => {
        expect(client.postSessionIdPermissionsPermissionId).toHaveBeenCalledWith({
          path: {
            id: "session-1",
            permissionID: "perm-123",
          },
          body: {
            response: "once",
          },
        });
      });
    });

    it("should send permission response (always)", async () => {
      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({
          command: "permission_response",
          permission_id: "perm-123",
          response: "always",
        })
      );

      await vi.waitFor(() => {
        expect(client.postSessionIdPermissionsPermissionId).toHaveBeenCalledWith({
          path: {
            id: "session-1",
            permissionID: "perm-123",
          },
          body: {
            response: "always",
          },
        });
      });
    });

    it("should send permission response (reject)", async () => {
      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({
          command: "permission_response",
          permission_id: "perm-123",
          response: "reject",
        })
      );

      await vi.waitFor(() => {
        expect(client.postSessionIdPermissionsPermissionId).toHaveBeenCalledWith({
          path: {
            id: "session-1",
            permissionID: "perm-123",
          },
          body: {
            response: "reject",
          },
        });
      });
    });

    it("should clear permission after successful response", async () => {
      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({
          command: "permission_response",
          permission_id: "perm-123",
          response: "once",
        })
      );

      await vi.waitFor(() => {
        expect(state.clearPermission).toHaveBeenCalled();
      });
    });

    it("should reject when no pending permission", async () => {
      state = createMockState({ sessionId: "session-1", pendingPermission: null });
      handler = new CommandHandler(mqtt, discovery, state, client);
      await handler.start();

      const { notify } = await import("../src/notify.js");

      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({
          command: "permission_response",
          permission_id: "perm-123",
          response: "once",
        })
      );

      await vi.waitFor(() => {
        expect(notify).toHaveBeenCalledWith("Permission Error", "No pending permission");
      });
    });

    it("should reject mismatched permission ID", async () => {
      const { notify } = await import("../src/notify.js");

      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({
          command: "permission_response",
          permission_id: "wrong-id",
          response: "once",
        })
      );

      await vi.waitFor(() => {
        expect(notify).toHaveBeenCalledWith("Permission Error", "Permission ID mismatch");
      });
    });

    it("should reject invalid response value", async () => {
      const { notify } = await import("../src/notify.js");

      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({
          command: "permission_response",
          permission_id: "perm-123",
          response: "invalid",
        })
      );

      await vi.waitFor(() => {
        expect(notify).toHaveBeenCalledWith("Permission Error", "Invalid response: invalid");
      });
    });
  });

  describe("get_history command", () => {
    beforeEach(async () => {
      // Set up mock messages
      (client.session.messages as Mock).mockResolvedValue({
        data: [
          {
            info: {
              id: "msg-1",
              role: "user",
              time: { created: "2025-01-06T10:00:00Z" },
            },
            parts: [{ type: "text", text: "Hello" }],
          },
          {
            info: {
              id: "msg-2",
              role: "assistant",
              providerID: "anthropic",
              modelID: "claude-sonnet-4-20250514",
              tokens: { input: 100, output: 50 },
              cost: 0.001,
              time: { created: "2025-01-06T10:00:01Z" },
            },
            parts: [{ type: "text", text: "Hi there!" }],
          },
        ],
      });

      await handler.start();
    });

    it("should fetch and publish history", async () => {
      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({ command: "get_history" })
      );

      await vi.waitFor(() => {
        expect(client.session.get).toHaveBeenCalledWith({
          path: { id: "session-1" },
        });
        expect(client.session.messages).toHaveBeenCalledWith({
          path: { id: "session-1" },
        });
      });

      await vi.waitFor(() => {
        expect(mqtt.publish).toHaveBeenCalledWith(
          "opencode/opencode_test/response",
          expect.objectContaining({
            type: "history",
            session_id: "session-1",
            session_title: "Test Session",
            messages: expect.arrayContaining([
              expect.objectContaining({
                id: "msg-1",
                role: "user",
                parts: [{ type: "text", content: "Hello" }],
              }),
              expect.objectContaining({
                id: "msg-2",
                role: "assistant",
                model: "claude-sonnet-4-20250514",
                provider: "anthropic",
                tokens_input: 100,
                tokens_output: 50,
                cost: 0.001,
              }),
            ]),
          }),
          false
        );
      });
    });

    it("should echo back request_id", async () => {
      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({ command: "get_history", request_id: "req-abc" })
      );

      await vi.waitFor(() => {
        expect(mqtt.publish).toHaveBeenCalledWith(
          "opencode/opencode_test/response",
          expect.objectContaining({
            request_id: "req-abc",
          }),
          false
        );
      });
    });

    it("should use provided session_id", async () => {
      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({ command: "get_history", session_id: "custom-session" })
      );

      await vi.waitFor(() => {
        expect(client.session.get).toHaveBeenCalledWith({
          path: { id: "custom-session" },
        });
      });
    });

    it("should reject when no active session", async () => {
      state = createMockState({ sessionId: null });
      handler = new CommandHandler(mqtt, discovery, state, client);
      await handler.start();

      const { notify } = await import("../src/notify.js");

      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({ command: "get_history" })
      );

      await vi.waitFor(() => {
        expect(notify).toHaveBeenCalledWith("History Error", "No active session");
      });
    });
  });

  describe("get_history_since command", () => {
    beforeEach(async () => {
      (client.session.messages as Mock).mockResolvedValue({
        data: [
          {
            info: {
              id: "msg-1",
              role: "user",
              time: { created: "2025-01-06T09:00:00Z" },
            },
            parts: [{ type: "text", text: "Old message" }],
          },
          {
            info: {
              id: "msg-2",
              role: "user",
              time: { created: "2025-01-06T11:00:00Z" },
            },
            parts: [{ type: "text", text: "New message" }],
          },
        ],
      });

      await handler.start();
    });

    it("should filter messages by since timestamp", async () => {
      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({
          command: "get_history_since",
          since: "2025-01-06T10:00:00Z",
        })
      );

      await vi.waitFor(() => {
        expect(mqtt.publish).toHaveBeenCalledWith(
          "opencode/opencode_test/response",
          expect.objectContaining({
            type: "history",
            since: "2025-01-06T10:00:00Z",
            messages: expect.arrayContaining([
              expect.objectContaining({
                id: "msg-2",
                parts: [{ type: "text", content: "New message" }],
              }),
            ]),
          }),
          false
        );
      });

      // Should NOT include the old message
      const publishCall = (mqtt.publish as Mock).mock.calls[0];
      const response = publishCall[1];
      expect(response.messages).toHaveLength(1);
      expect(response.messages[0].id).toBe("msg-2");
    });

    it("should reject missing since timestamp", async () => {
      const { notify } = await import("../src/notify.js");

      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({ command: "get_history_since" })
      );

      await vi.waitFor(() => {
        expect(notify).toHaveBeenCalledWith("History Error", "Missing 'since' timestamp");
      });
    });

    it("should reject invalid since timestamp", async () => {
      const { notify } = await import("../src/notify.js");

      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({ command: "get_history_since", since: "not-a-date" })
      );

      await vi.waitFor(() => {
        expect(notify).toHaveBeenCalledWith("History Error", "Invalid 'since' timestamp");
      });
    });
  });

  describe("message part types", () => {
    beforeEach(async () => {
      await handler.start();
    });

    it("should handle tool parts", async () => {
      (client.session.messages as Mock).mockResolvedValue({
        data: [
          {
            info: {
              id: "msg-1",
              role: "assistant",
              time: { created: "2025-01-06T10:00:00Z" },
            },
            parts: [
              {
                type: "tool",
                tool: "read",
                id: "tool-1",
                args: { path: "/test.txt" },
                state: { output: "file contents", error: undefined },
              },
            ],
          },
        ],
      });

      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({ command: "get_history" })
      );

      await vi.waitFor(() => {
        expect(mqtt.publish).toHaveBeenCalledWith(
          "opencode/opencode_test/response",
          expect.objectContaining({
            messages: [
              expect.objectContaining({
                parts: [
                  expect.objectContaining({
                    type: "tool_call",
                    tool_name: "read",
                    tool_id: "tool-1",
                    tool_args: { path: "/test.txt" },
                    tool_output: "file contents",
                  }),
                ],
              }),
            ],
          }),
          false
        );
      });
    });

    it("should handle file parts as images", async () => {
      (client.session.messages as Mock).mockResolvedValue({
        data: [
          {
            info: {
              id: "msg-1",
              role: "user",
              time: { created: "2025-01-06T10:00:00Z" },
            },
            parts: [
              {
                type: "file",
                filename: "screenshot.png",
                url: "file:///tmp/screenshot.png",
              },
            ],
          },
        ],
      });

      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({ command: "get_history" })
      );

      await vi.waitFor(() => {
        expect(mqtt.publish).toHaveBeenCalledWith(
          "opencode/opencode_test/response",
          expect.objectContaining({
            messages: [
              expect.objectContaining({
                parts: [
                  expect.objectContaining({
                    type: "image",
                    content: "screenshot.png",
                  }),
                ],
              }),
            ],
          }),
          false
        );
      });
    });

    it("should handle unknown part types", async () => {
      (client.session.messages as Mock).mockResolvedValue({
        data: [
          {
            info: {
              id: "msg-1",
              role: "assistant",
              time: { created: "2025-01-06T10:00:00Z" },
            },
            parts: [
              {
                type: "custom_type",
                data: "something",
              },
            ],
          },
        ],
      });

      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({ command: "get_history" })
      );

      await vi.waitFor(() => {
        expect(mqtt.publish).toHaveBeenCalledWith(
          "opencode/opencode_test/response",
          expect.objectContaining({
            messages: [
              expect.objectContaining({
                parts: [
                  expect.objectContaining({
                    type: "other",
                    content: JSON.stringify({ type: "custom_type", data: "something" }),
                  }),
                ],
              }),
            ],
          }),
          false
        );
      });
    });
  });

  describe("unknown commands", () => {
    beforeEach(async () => {
      await handler.start();
    });

    it("should notify on unknown command", async () => {
      const { notify } = await import("../src/notify.js");

      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({ command: "unknown_command" })
      );

      await vi.waitFor(() => {
        expect(notify).toHaveBeenCalledWith("Unknown Command", "Unrecognized: unknown_command");
      });
    });
  });

  describe("error handling", () => {
    beforeEach(async () => {
      await handler.start();
    });

    it("should handle prompt API failure", async () => {
      (client.session.prompt as Mock).mockRejectedValue(new Error("API error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { notify } = await import("../src/notify.js");

      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({ command: "prompt", text: "Hello" })
      );

      await vi.waitFor(() => {
        expect(notify).toHaveBeenCalledWith("Prompt Failed", "API error");
      });
      consoleSpy.mockRestore();
    });

    it("should handle history API failure", async () => {
      (client.session.get as Mock).mockRejectedValue(new Error("Session not found"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { notify } = await import("../src/notify.js");

      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({ command: "get_history" })
      );

      await vi.waitFor(() => {
        expect(notify).toHaveBeenCalledWith("History Failed", "Session not found");
      });
      consoleSpy.mockRestore();
    });

    it("should handle permission API failure", async () => {
      state = createMockState({
        sessionId: "session-1",
        pendingPermission: {
          id: "perm-123",
          type: "bash",
          title: "Run command",
          sessionID: "session-1",
          messageID: "msg-1",
        },
      });
      handler = new CommandHandler(mqtt, discovery, state, client);
      await handler.start();

      (client.postSessionIdPermissionsPermissionId as Mock).mockRejectedValue(
        new Error("Permission expired")
      );
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { notify } = await import("../src/notify.js");

      messageCallback(
        "opencode/opencode_test/command",
        JSON.stringify({
          command: "permission_response",
          permission_id: "perm-123",
          response: "once",
        })
      );

      await vi.waitFor(() => {
        expect(notify).toHaveBeenCalledWith("Permission Error", "Failed to send response");
      });
      consoleSpy.mockRestore();
    });
  });
});
