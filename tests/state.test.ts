import { describe, it, expect, vi, beforeEach } from "vitest";
import { StateTracker } from "../src/state.js";
import type { HAWebSocketClient } from "../src/websocket.js";
import type { Event } from "@opencode-ai/sdk";

// Mock the os module
vi.mock("os", () => ({
  hostname: () => "test-host",
}));

describe("StateTracker", () => {
  let stateTracker: StateTracker;
  let mockWsClient: HAWebSocketClient;

  beforeEach(() => {
    mockWsClient = {
      sendSessionUpdate: vi.fn().mockResolvedValue(undefined),
      sendSessionRemoved: vi.fn().mockResolvedValue(undefined),
      sendStateResponse: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      onCommand: vi.fn(),
      onStateRequest: vi.fn(),
      onDisconnect: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      pair: vi.fn().mockResolvedValue({ success: true }),
      reconnect: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as HAWebSocketClient;

    stateTracker = new StateTracker(mockWsClient, "test-token", "test-project");
  });

  describe("initial state", () => {
    it("should start with no session ID", () => {
      expect(stateTracker.getCurrentSessionId()).toBeNull();
    });

    it("should start with no pending permission", () => {
      expect(stateTracker.getPendingPermission()).toBeNull();
    });

    it("should return empty sessions when no session exists", () => {
      expect(stateTracker.getAllSessions()).toEqual([]);
    });
  });

  describe("setSessionId", () => {
    it("should set the session ID", async () => {
      await stateTracker.setSessionId("ses_123");
      expect(stateTracker.getCurrentSessionId()).toBe("ses_123");
    });

    it("should publish update when requested", async () => {
      await stateTracker.setSessionId("ses_123", true);
      expect(mockWsClient.sendSessionUpdate).toHaveBeenCalled();
    });

    it("should not publish update by default", async () => {
      await stateTracker.setSessionId("ses_123");
      expect(mockWsClient.sendSessionUpdate).not.toHaveBeenCalled();
    });
  });

  describe("getAllSessions", () => {
    it("should return session data after session is set", async () => {
      await stateTracker.setSessionId("ses_123");
      const sessions = stateTracker.getAllSessions();
      
      expect(sessions).toHaveLength(1);
      expect(sessions[0].session_id).toBe("ses_123");
      expect(sessions[0].state).toBe("idle");
      expect(sessions[0].hostname).toBe("test-host");
    });
  });

  describe("session.created event", () => {
    it("should set session ID and title", async () => {
      const event: Event = {
        type: "session.created",
        properties: {
          info: {
            id: "ses_new123",
            title: "Test Session",
          },
        },
      } as Event;

      await stateTracker.handleEvent(event);

      expect(stateTracker.getCurrentSessionId()).toBe("ses_new123");
      const sessions = stateTracker.getAllSessions();
      expect(sessions[0].title).toBe("Test Session");
    });

    it("should reset tokens and cost", async () => {
      // First set some values
      await stateTracker.setSessionId("ses_old");
      
      const event: Event = {
        type: "session.created",
        properties: {
          info: {
            id: "ses_new123",
            title: "New Session",
          },
        },
      } as Event;

      await stateTracker.handleEvent(event);

      const sessions = stateTracker.getAllSessions();
      expect(sessions[0].tokens_input).toBe(0);
      expect(sessions[0].tokens_output).toBe(0);
      expect(sessions[0].cost).toBe(0);
    });

    it("should remove old session when switching", async () => {
      await stateTracker.setSessionId("ses_old");
      
      const event: Event = {
        type: "session.created",
        properties: {
          info: {
            id: "ses_new",
            title: "New Session",
          },
        },
      } as Event;

      await stateTracker.handleEvent(event);

      expect(mockWsClient.sendSessionRemoved).toHaveBeenCalledWith(
        "test-token",
        "ses_old"
      );
    });
  });

  describe("session.updated event", () => {
    it("should update session title", async () => {
      await stateTracker.setSessionId("ses_123");
      
      const event: Event = {
        type: "session.updated",
        properties: {
          info: {
            id: "ses_123",
            title: "Updated Title",
          },
        },
      } as Event;

      await stateTracker.handleEvent(event);

      const sessions = stateTracker.getAllSessions();
      expect(sessions[0].title).toBe("Updated Title");
    });
  });

  describe("session.idle event", () => {
    it("should transition to idle state", async () => {
      await stateTracker.setSessionId("ses_123");
      
      // First transition to working
      const workingEvent: Event = {
        type: "message.part.updated",
        properties: {
          part: { type: "text" },
          delta: "hello",
        },
      } as unknown as Event;
      await stateTracker.handleEvent(workingEvent);

      // Now idle
      const idleEvent: Event = {
        type: "session.idle",
        properties: {},
      } as Event;
      await stateTracker.handleEvent(idleEvent);

      const sessions = stateTracker.getAllSessions();
      expect(sessions[0].state).toBe("idle");
      expect(sessions[0].current_tool).toBe("none");
    });
  });

  describe("session.error event", () => {
    it("should transition to error state with message", async () => {
      await stateTracker.setSessionId("ses_123");
      
      const event: Event = {
        type: "session.error",
        properties: {
          error: { message: "Something went wrong" },
        },
      } as unknown as Event;

      await stateTracker.handleEvent(event);

      const sessions = stateTracker.getAllSessions();
      expect(sessions[0].state).toBe("error");
      expect(sessions[0].error_message).toBe("Something went wrong");
    });
  });

  describe("message.updated event", () => {
    it("should track agent from user message", async () => {
      await stateTracker.setSessionId("ses_123");
      
      const event: Event = {
        type: "message.updated",
        properties: {
          info: {
            id: "msg_1",
            role: "user",
            agent: "code",
          },
        },
      } as unknown as Event;

      await stateTracker.handleEvent(event);

      const sessions = stateTracker.getAllSessions();
      expect(sessions[0].agent).toBe("code");
    });

    it("should track model and tokens from assistant message", async () => {
      await stateTracker.setSessionId("ses_123");
      
      const event: Event = {
        type: "message.updated",
        properties: {
          info: {
            id: "msg_1",
            role: "assistant",
            providerID: "anthropic",
            modelID: "claude-3",
            tokens: { input: 100, output: 50 },
            cost: 0.005,
          },
        },
      } as unknown as Event;

      await stateTracker.handleEvent(event);

      const sessions = stateTracker.getAllSessions();
      expect(sessions[0].model).toBe("anthropic/claude-3");
      expect(sessions[0].tokens_input).toBe(100);
      expect(sessions[0].tokens_output).toBe(50);
      expect(sessions[0].cost).toBe(0.005);
    });
  });

  describe("message.part.updated event", () => {
    it("should transition to working on text delta", async () => {
      await stateTracker.setSessionId("ses_123");
      
      const event: Event = {
        type: "message.part.updated",
        properties: {
          part: { type: "text" },
          delta: "Hello",
        },
      } as unknown as Event;

      await stateTracker.handleEvent(event);

      const sessions = stateTracker.getAllSessions();
      expect(sessions[0].state).toBe("working");
    });

    it("should track current agent from agent part", async () => {
      await stateTracker.setSessionId("ses_123");
      
      const event: Event = {
        type: "message.part.updated",
        properties: {
          part: { type: "agent", name: "explore" },
        },
      } as unknown as Event;

      await stateTracker.handleEvent(event);

      const sessions = stateTracker.getAllSessions();
      expect(sessions[0].current_agent).toBe("explore");
    });

    it("should track running tool", async () => {
      await stateTracker.setSessionId("ses_123");
      
      const event: Event = {
        type: "message.part.updated",
        properties: {
          part: { 
            type: "tool", 
            tool: "bash",
            state: { status: "running" },
          },
        },
      } as unknown as Event;

      await stateTracker.handleEvent(event);

      const sessions = stateTracker.getAllSessions();
      expect(sessions[0].current_tool).toBe("bash");
      expect(sessions[0].state).toBe("working");
    });

    it("should clear tool when completed", async () => {
      await stateTracker.setSessionId("ses_123");
      
      // Start tool
      await stateTracker.handleEvent({
        type: "message.part.updated",
        properties: {
          part: { 
            type: "tool", 
            tool: "bash",
            state: { status: "running" },
          },
        },
      } as unknown as Event);

      // Complete tool
      await stateTracker.handleEvent({
        type: "message.part.updated",
        properties: {
          part: { 
            type: "tool", 
            tool: "bash",
            state: { status: "completed" },
          },
        },
      } as unknown as Event);

      const sessions = stateTracker.getAllSessions();
      expect(sessions[0].current_tool).toBe("none");
    });
  });

  describe("permission.updated event", () => {
    it("should transition to waiting_permission and track permission", async () => {
      await stateTracker.setSessionId("ses_123");
      
      const event: Event = {
        type: "permission.updated",
        properties: {
          id: "perm_1",
          type: "file",
          title: "Read file",
          sessionID: "ses_123",
          messageID: "msg_1",
          callID: "call_1",
          pattern: "*.ts",
          metadata: {},
        },
      } as unknown as Event;

      await stateTracker.handleEvent(event);

      const sessions = stateTracker.getAllSessions();
      expect(sessions[0].state).toBe("waiting_permission");
      
      const permission = stateTracker.getPendingPermission();
      expect(permission).not.toBeNull();
      expect(permission!.id).toBe("perm_1");
      expect(permission!.type).toBe("file");
    });
  });

  describe("permission.replied event", () => {
    it("should clear permission and transition to working", async () => {
      await stateTracker.setSessionId("ses_123");
      
      // First set a permission
      await stateTracker.handleEvent({
        type: "permission.updated",
        properties: {
          id: "perm_1",
          type: "file",
          title: "Read file",
          sessionID: "ses_123",
          messageID: "msg_1",
          callID: "call_1",
          pattern: "*.ts",
          metadata: {},
        },
      } as unknown as Event);

      // Then reply
      await stateTracker.handleEvent({
        type: "permission.replied",
        properties: {},
      } as unknown as Event);

      const sessions = stateTracker.getAllSessions();
      expect(sessions[0].state).toBe("working");
      expect(stateTracker.getPendingPermission()).toBeNull();
    });
  });

  describe("clearPermission", () => {
    it("should clear pending permission", async () => {
      await stateTracker.setSessionId("ses_123");
      
      // Set a permission
      await stateTracker.handleEvent({
        type: "permission.updated",
        properties: {
          id: "perm_1",
          type: "file",
          title: "Read file",
          sessionID: "ses_123",
          messageID: "msg_1",
          callID: "call_1",
          pattern: "*.ts",
          metadata: {},
        },
      } as unknown as Event);

      expect(stateTracker.getPendingPermission()).not.toBeNull();

      await stateTracker.clearPermission();

      expect(stateTracker.getPendingPermission()).toBeNull();
    });
  });

  describe("previous_state tracking", () => {
    it("should track previous state on transitions", async () => {
      await stateTracker.setSessionId("ses_123");
      
      // Start idle, transition to working
      await stateTracker.handleEvent({
        type: "message.part.updated",
        properties: {
          part: { type: "text" },
          delta: "hello",
        },
      } as unknown as Event);

      const sessions = stateTracker.getAllSessions();
      expect(sessions[0].state).toBe("working");
      expect(sessions[0].previous_state).toBe("idle");
    });
  });
});
