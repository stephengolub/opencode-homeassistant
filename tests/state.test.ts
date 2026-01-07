import { describe, it, expect, vi, beforeEach } from "vitest";
import { StateTracker } from "../src/state.js";
import type { Discovery } from "../src/discovery.js";

// Mock Discovery with all required methods including updateDeviceName
function createMockDiscovery(): Discovery {
  return {
    deviceId: "opencode_test",
    registerDevice: vi.fn().mockResolvedValue(undefined),
    updateDeviceName: vi.fn().mockResolvedValue(undefined),
    publishDeviceInfo: vi.fn().mockResolvedValue(undefined),
    publishState: vi.fn().mockResolvedValue(undefined),
    publishAttributes: vi.fn().mockResolvedValue(undefined),
    publishPermission: vi.fn().mockResolvedValue(undefined),
    publishAvailable: vi.fn().mockResolvedValue(undefined),
    publishUnavailable: vi.fn().mockResolvedValue(undefined),
    getStateTopic: vi.fn((key: string) => `opencode/opencode_test/${key}`),
    getAttributesTopic: vi.fn(
      (key: string) => `opencode/opencode_test/${key}/attributes`
    ),
    getCommandTopic: vi.fn(() => "opencode/opencode_test/command"),
    getResponseTopic: vi.fn(() => "opencode/opencode_test/response"),
    getAvailabilityTopic: vi.fn(() => "opencode/opencode_test/availability"),
    unregisterDevice: vi.fn().mockResolvedValue(undefined),
  } as unknown as Discovery;
}

describe("StateTracker", () => {
  let discovery: Discovery;
  let stateTracker: StateTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    discovery = createMockDiscovery();
    stateTracker = new StateTracker(discovery);
  });

  describe("initialize", () => {
    it("should register device and publish initial state on initialize", async () => {
      await stateTracker.initialize();

      expect(discovery.registerDevice).toHaveBeenCalled();
      expect(discovery.publishDeviceInfo).toHaveBeenCalled();
      expect(discovery.publishAvailable).toHaveBeenCalled();
      expect(discovery.publishState).toHaveBeenCalledWith("state", "idle");
      expect(discovery.publishPermission).toHaveBeenCalledWith(null);
    });
  });

  describe("updateDeviceName", () => {
    it("should update device name when valid title is received", async () => {
      await stateTracker.initialize();
      vi.clearAllMocks();

      const event = {
        type: "session.updated",
        properties: {
          info: {
            id: "session-1",
            title: "Implementing feature X",
            projectID: "project-1",
            time: { created: Date.now() },
          },
        },
      };
      await stateTracker.handleEvent(
        event as Parameters<typeof stateTracker.handleEvent>[0]
      );

      expect(discovery.updateDeviceName).toHaveBeenCalledWith(
        "Implementing feature X"
      );
    });

    it("should not update device name for Untitled session", async () => {
      await stateTracker.initialize();
      vi.clearAllMocks();

      const event = {
        type: "session.updated",
        properties: {
          info: {
            id: "session-1",
            title: "Untitled",
            projectID: "project-1",
            time: { created: Date.now() },
          },
        },
      };
      await stateTracker.handleEvent(
        event as Parameters<typeof stateTracker.handleEvent>[0]
      );

      expect(discovery.updateDeviceName).not.toHaveBeenCalled();
    });

    it("should only update device name once", async () => {
      await stateTracker.initialize();
      vi.clearAllMocks();

      // First update with valid title
      const event1 = {
        type: "session.updated",
        properties: {
          info: {
            id: "session-1",
            title: "First Title",
            projectID: "project-1",
            time: { created: Date.now() },
          },
        },
      };
      await stateTracker.handleEvent(
        event1 as Parameters<typeof stateTracker.handleEvent>[0]
      );

      // Second update with different title
      const event2 = {
        type: "session.updated",
        properties: {
          info: {
            id: "session-1",
            title: "Second Title",
            projectID: "project-1",
            time: { created: Date.now() },
          },
        },
      };
      await stateTracker.handleEvent(
        event2 as Parameters<typeof stateTracker.handleEvent>[0]
      );

      // Should only be called once (for first valid title)
      expect(discovery.updateDeviceName).toHaveBeenCalledTimes(1);
      expect(discovery.updateDeviceName).toHaveBeenCalledWith("First Title");
    });
  });

  describe("state transitions", () => {
    beforeEach(async () => {
      await stateTracker.initialize();
      vi.clearAllMocks();
    });

    it("should transition to working on text delta", async () => {
      const event = {
        type: "message.part.updated",
        properties: {
          part: {
            type: "text",
            text: "Hello",
          },
          delta: "Hello",
        },
      };

      await stateTracker.handleEvent(
        event as Parameters<typeof stateTracker.handleEvent>[0]
      );

      expect(discovery.publishState).toHaveBeenCalledWith("state", "working");
    });

    it("should transition to idle on session.idle", async () => {
      // First go to working
      const workingEvent = {
        type: "message.part.updated",
        properties: {
          part: { type: "text", text: "Hi" },
          delta: "Hi",
        },
      };
      await stateTracker.handleEvent(
        workingEvent as Parameters<typeof stateTracker.handleEvent>[0]
      );
      vi.clearAllMocks();

      // Then go idle
      const idleEvent = {
        type: "session.idle",
        properties: {},
      };

      await stateTracker.handleEvent(
        idleEvent as Parameters<typeof stateTracker.handleEvent>[0]
      );

      expect(discovery.publishState).toHaveBeenCalledWith("state", "idle");
    });

    it("should transition to error on session.error", async () => {
      const event = {
        type: "session.error",
        properties: {
          error: {
            name: "TestError",
            message: "Something went wrong",
          },
        },
      };

      await stateTracker.handleEvent(
        event as Parameters<typeof stateTracker.handleEvent>[0]
      );

      expect(discovery.publishState).toHaveBeenCalledWith("state", "error");
      expect(discovery.publishAttributes).toHaveBeenCalledWith(
        "state",
        expect.objectContaining({
          error_message: "Something went wrong",
        })
      );
    });

    it("should transition to waiting_permission on permission.updated", async () => {
      const event = {
        type: "permission.updated",
        properties: {
          id: "perm-1",
          type: "file_write",
          title: "Write to file.txt",
          sessionID: "session-1",
          messageID: "msg-1",
          metadata: {},
        },
      };

      await stateTracker.handleEvent(
        event as Parameters<typeof stateTracker.handleEvent>[0]
      );

      expect(discovery.publishState).toHaveBeenCalledWith(
        "state",
        "waiting_permission"
      );
      expect(discovery.publishPermission).toHaveBeenCalled();
    });
  });

  describe("previous_state tracking", () => {
    beforeEach(async () => {
      await stateTracker.initialize();
      vi.clearAllMocks();
    });

    it("should publish previous_state attribute when state changes", async () => {
      // Go to working
      const workingEvent = {
        type: "message.part.updated",
        properties: {
          part: { type: "text", text: "Hi" },
          delta: "Hi",
        },
      };
      await stateTracker.handleEvent(
        workingEvent as Parameters<typeof stateTracker.handleEvent>[0]
      );
      vi.clearAllMocks();

      // Go to idle - should have previous_state = "working"
      const idleEvent = {
        type: "session.idle",
        properties: {},
      };
      await stateTracker.handleEvent(
        idleEvent as Parameters<typeof stateTracker.handleEvent>[0]
      );

      // Check that attributes were published with previous_state
      expect(discovery.publishAttributes).toHaveBeenCalledWith(
        "state",
        expect.objectContaining({
          previous_state: "working",
        })
      );
    });
  });

  describe("agent tracking", () => {
    beforeEach(async () => {
      await stateTracker.initialize();
      vi.clearAllMocks();
    });

    it("should track agent from user message", async () => {
      const event = {
        type: "message.updated",
        properties: {
          info: {
            id: "msg-1",
            role: "user",
            agent: "build",
            sessionID: "session-1",
            time: { created: Date.now() },
          },
        },
      };

      await stateTracker.handleEvent(
        event as Parameters<typeof stateTracker.handleEvent>[0]
      );

      expect(discovery.publishAttributes).toHaveBeenCalledWith(
        "state",
        expect.objectContaining({
          agent: "build",
        })
      );
    });

    it("should track current_agent from agent part", async () => {
      const event = {
        type: "message.part.updated",
        properties: {
          part: {
            type: "agent",
            name: "explore",
          },
        },
      };

      await stateTracker.handleEvent(
        event as Parameters<typeof stateTracker.handleEvent>[0]
      );

      expect(discovery.publishAttributes).toHaveBeenCalledWith(
        "state",
        expect.objectContaining({
          current_agent: "explore",
        })
      );
    });
  });

  describe("permission lifecycle", () => {
    beforeEach(async () => {
      await stateTracker.initialize();
      vi.clearAllMocks();
    });

    it("should transition to working after permission replied", async () => {
      // First request permission
      const permissionEvent = {
        type: "permission.updated",
        properties: {
          id: "perm-1",
          type: "file_write",
          title: "Write to file.txt",
          sessionID: "session-1",
          messageID: "msg-1",
          metadata: {},
        },
      };
      await stateTracker.handleEvent(
        permissionEvent as Parameters<typeof stateTracker.handleEvent>[0]
      );
      vi.clearAllMocks();

      // Then permission is replied
      const repliedEvent = {
        type: "permission.replied",
        properties: {},
      };
      await stateTracker.handleEvent(
        repliedEvent as Parameters<typeof stateTracker.handleEvent>[0]
      );

      expect(discovery.publishState).toHaveBeenCalledWith("state", "working");
      expect(discovery.publishPermission).toHaveBeenCalledWith(null);
    });

    it("should clear pending permission via clearPermission()", async () => {
      // First request permission
      const permissionEvent = {
        type: "permission.updated",
        properties: {
          id: "perm-1",
          type: "file_write",
          title: "Write to file.txt",
          sessionID: "session-1",
          messageID: "msg-1",
          metadata: {},
        },
      };
      await stateTracker.handleEvent(
        permissionEvent as Parameters<typeof stateTracker.handleEvent>[0]
      );

      expect(stateTracker.getPendingPermission()).not.toBeNull();

      await stateTracker.clearPermission();

      expect(stateTracker.getPendingPermission()).toBeNull();
      expect(discovery.publishPermission).toHaveBeenCalledWith(null);
    });

    it("should track pending permission details", async () => {
      const permissionEvent = {
        type: "permission.updated",
        properties: {
          id: "perm-123",
          type: "bash",
          title: "Execute command: rm -rf /",
          sessionID: "session-1",
          messageID: "msg-1",
          callID: "call-1",
          pattern: "rm *",
          metadata: { dangerous: true },
        },
      };
      await stateTracker.handleEvent(
        permissionEvent as Parameters<typeof stateTracker.handleEvent>[0]
      );

      const pending = stateTracker.getPendingPermission();
      expect(pending).toMatchObject({
        id: "perm-123",
        type: "bash",
        title: "Execute command: rm -rf /",
        sessionID: "session-1",
        messageID: "msg-1",
        callID: "call-1",
        pattern: "rm *",
      });
    });
  });

  describe("token and cost tracking", () => {
    beforeEach(async () => {
      await stateTracker.initialize();
      vi.clearAllMocks();
    });

    it("should track tokens and cost from assistant message", async () => {
      const event = {
        type: "message.updated",
        properties: {
          info: {
            id: "msg-1",
            role: "assistant",
            providerID: "anthropic",
            modelID: "claude-sonnet-4-20250514",
            sessionID: "session-1",
            tokens: {
              input: 1000,
              output: 500,
            },
            cost: 0.0075,
            time: { created: Date.now() },
          },
        },
      };

      await stateTracker.handleEvent(
        event as Parameters<typeof stateTracker.handleEvent>[0]
      );

      expect(discovery.publishState).toHaveBeenCalledWith(
        "model",
        "anthropic/claude-sonnet-4-20250514"
      );
      expect(discovery.publishState).toHaveBeenCalledWith("tokens_input", 1000);
      expect(discovery.publishState).toHaveBeenCalledWith("tokens_output", 500);
      expect(discovery.publishState).toHaveBeenCalledWith("cost", 0.0075);
    });
  });

  describe("session lifecycle", () => {
    it("should track current session ID", async () => {
      expect(stateTracker.getCurrentSessionId()).toBeNull();

      await stateTracker.initialize();

      const event = {
        type: "session.created",
        properties: {
          info: {
            id: "session-abc-123",
            title: "New Session",
            projectID: "project-1",
            time: { created: Date.now() },
          },
        },
      };
      await stateTracker.handleEvent(
        event as Parameters<typeof stateTracker.handleEvent>[0]
      );

      expect(stateTracker.getCurrentSessionId()).toBe("session-abc-123");
    });

    it("should reset tokens and cost on session created", async () => {
      await stateTracker.initialize();

      // First send some token/cost updates
      const msgEvent = {
        type: "message.updated",
        properties: {
          info: {
            id: "msg-1",
            role: "assistant",
            providerID: "anthropic",
            modelID: "claude-sonnet-4-20250514",
            sessionID: "session-1",
            tokens: { input: 5000, output: 2000 },
            cost: 0.05,
            time: { created: Date.now() },
          },
        },
      };
      await stateTracker.handleEvent(
        msgEvent as Parameters<typeof stateTracker.handleEvent>[0]
      );
      vi.clearAllMocks();

      // Now create a new session
      const createEvent = {
        type: "session.created",
        properties: {
          info: {
            id: "session-2",
            title: "New Session",
            projectID: "project-1",
            time: { created: Date.now() },
          },
        },
      };
      await stateTracker.handleEvent(
        createEvent as Parameters<typeof stateTracker.handleEvent>[0]
      );

      // Tokens and cost should be reset to 0
      expect(discovery.publishState).toHaveBeenCalledWith("tokens_input", 0);
      expect(discovery.publishState).toHaveBeenCalledWith("tokens_output", 0);
      expect(discovery.publishState).toHaveBeenCalledWith("cost", 0);
    });
  });

  describe("tool tracking", () => {
    beforeEach(async () => {
      await stateTracker.initialize();
      vi.clearAllMocks();
    });

    it("should track running tool", async () => {
      const event = {
        type: "message.part.updated",
        properties: {
          part: {
            type: "tool",
            tool: "read",
            id: "tool-1",
            state: {
              status: "running",
            },
          },
        },
      };

      await stateTracker.handleEvent(
        event as Parameters<typeof stateTracker.handleEvent>[0]
      );

      expect(discovery.publishState).toHaveBeenCalledWith(
        "current_tool",
        "read"
      );
      expect(discovery.publishState).toHaveBeenCalledWith("state", "working");
    });

    it("should clear tool when completed", async () => {
      // First start tool
      const startEvent = {
        type: "message.part.updated",
        properties: {
          part: {
            type: "tool",
            tool: "read",
            id: "tool-1",
            state: { status: "running" },
          },
        },
      };
      await stateTracker.handleEvent(
        startEvent as Parameters<typeof stateTracker.handleEvent>[0]
      );
      vi.clearAllMocks();

      // Then complete
      const completeEvent = {
        type: "message.part.updated",
        properties: {
          part: {
            type: "tool",
            tool: "read",
            id: "tool-1",
            state: { status: "completed" },
          },
        },
      };
      await stateTracker.handleEvent(
        completeEvent as Parameters<typeof stateTracker.handleEvent>[0]
      );

      expect(discovery.publishState).toHaveBeenCalledWith(
        "current_tool",
        "none"
      );
    });
  });
});
