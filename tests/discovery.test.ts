import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  Discovery,
  extractSessionIdPart,
  getDeviceIdForSession,
  getAvailabilityTopicForSession,
  createWillConfig,
  type PermissionInfo,
} from "../src/discovery.js";
import type { MqttWrapper } from "../src/mqtt.js";
import type { HaConfig } from "../src/config.js";

// Mock MQTT
function createMockMqtt(): MqttWrapper {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as MqttWrapper;
}

// Default HA config
const defaultHaConfig: HaConfig = {
  discoveryPrefix: "homeassistant",
};

describe("extractSessionIdPart", () => {
  it("should strip ses_ prefix", () => {
    expect(extractSessionIdPart("ses_abc123")).toBe("abc123");
  });

  it("should handle session ID without prefix", () => {
    expect(extractSessionIdPart("abc123")).toBe("abc123");
  });

  it("should handle full session ID", () => {
    expect(extractSessionIdPart("ses_46b09b89bffevq6HeMNIkuvk4B")).toBe(
      "46b09b89bffevq6HeMNIkuvk4B"
    );
  });
});

describe("getDeviceIdForSession", () => {
  it("should generate device ID from session ID", () => {
    expect(getDeviceIdForSession("ses_abc123")).toBe("opencode_abc123");
  });

  it("should handle full session ID", () => {
    expect(getDeviceIdForSession("ses_46b09b89bffevq6HeMNIkuvk4B")).toBe(
      "opencode_46b09b89bffevq6HeMNIkuvk4B"
    );
  });
});

describe("getAvailabilityTopicForSession", () => {
  it("should generate availability topic from session ID", () => {
    const topic = getAvailabilityTopicForSession("ses_abc123");
    expect(topic).toBe("opencode/opencode_abc123/availability");
  });

  it("should handle full session ID", () => {
    const topic = getAvailabilityTopicForSession("ses_46b09b89bffevq6HeMNIkuvk4B");
    expect(topic).toBe("opencode/opencode_46b09b89bffevq6HeMNIkuvk4B/availability");
  });
});

describe("createWillConfig", () => {
  it("should create LWT config with offline payload", () => {
    const willConfig = createWillConfig("ses_abc123");

    expect(willConfig).toEqual({
      topic: "opencode/opencode_abc123/availability",
      payload: "offline",
      retain: true,
    });
  });
});

describe("Discovery", () => {
  let mqtt: MqttWrapper;
  let discovery: Discovery;
  const sessionId = "ses_abc123def456";
  const projectName = "my-project";

  beforeEach(() => {
    vi.clearAllMocks();
    mqtt = createMockMqtt();
    discovery = new Discovery(mqtt, defaultHaConfig, sessionId, projectName);
  });

  describe("constructor", () => {
    it("should set deviceId from session ID", () => {
      expect(discovery.deviceId).toBe("opencode_abc123def456");
    });

    it("should handle full session ID format", () => {
      const d = new Discovery(
        mqtt,
        defaultHaConfig,
        "ses_46b09b89bffevq6HeMNIkuvk4B",
        "test-project"
      );
      expect(d.deviceId).toBe("opencode_46b09b89bffevq6HeMNIkuvk4B");
    });
  });

  describe("topic generation", () => {
    it("should generate correct state topic", () => {
      expect(discovery.getStateTopic("state")).toBe(
        "opencode/opencode_abc123def456/state"
      );
      expect(discovery.getStateTopic("model")).toBe(
        "opencode/opencode_abc123def456/model"
      );
    });

    it("should generate correct attributes topic", () => {
      expect(discovery.getAttributesTopic("state")).toBe(
        "opencode/opencode_abc123def456/state/attributes"
      );
    });

    it("should generate correct command topic", () => {
      expect(discovery.getCommandTopic()).toBe(
        "opencode/opencode_abc123def456/command"
      );
    });

    it("should generate correct response topic", () => {
      expect(discovery.getResponseTopic()).toBe(
        "opencode/opencode_abc123def456/response"
      );
    });

    it("should generate correct availability topic", () => {
      expect(discovery.getAvailabilityTopic()).toBe(
        "opencode/opencode_abc123def456/availability"
      );
    });
  });

  describe("registerDevice", () => {
    it("should register all entities", async () => {
      await discovery.registerDevice();

      // Should publish config for each entity (10 entities defined)
      expect(mqtt.publish).toHaveBeenCalledTimes(10);
    });

    it("should publish to HA discovery topic", async () => {
      await discovery.registerDevice();

      // Check one entity config topic
      expect(mqtt.publish).toHaveBeenCalledWith(
        "homeassistant/sensor/opencode_abc123def456/state/config",
        expect.objectContaining({
          name: "State",
          unique_id: "opencode_abc123def456_state",
          state_topic: "opencode/opencode_abc123def456/state",
          icon: "mdi:state-machine",
        }),
        true
      );
    });

    it("should include device info with session-based naming", async () => {
      await discovery.registerDevice();

      expect(mqtt.publish).toHaveBeenCalledWith(
        expect.stringContaining("/config"),
        expect.objectContaining({
          device: {
            identifiers: ["opencode_abc123def456"],
            name: "OpenCode - my-project - Untitled",
            manufacturer: "OpenCode",
            model: "AI Coding Assistant",
            sw_version: "ses_abc123def456",
          },
        }),
        true
      );
    });

    it("should include availability config in entity", async () => {
      await discovery.registerDevice();

      expect(mqtt.publish).toHaveBeenCalledWith(
        expect.stringContaining("/config"),
        expect.objectContaining({
          availability_topic: "opencode/opencode_abc123def456/availability",
          payload_available: "online",
          payload_not_available: "offline",
        }),
        true
      );
    });

    it("should include json_attributes_topic for entities with attributes", async () => {
      await discovery.registerDevice();

      expect(mqtt.publish).toHaveBeenCalledWith(
        "homeassistant/sensor/opencode_abc123def456/state/config",
        expect.objectContaining({
          json_attributes_topic:
            "opencode/opencode_abc123def456/state/attributes",
        }),
        true
      );
    });

    it("should include unit_of_measurement for token entities", async () => {
      await discovery.registerDevice();

      expect(mqtt.publish).toHaveBeenCalledWith(
        "homeassistant/sensor/opencode_abc123def456/tokens_input/config",
        expect.objectContaining({
          unit_of_measurement: "tokens",
          state_class: "measurement",
        }),
        true
      );
    });

    it("should include device_class for timestamp entities", async () => {
      await discovery.registerDevice();

      expect(mqtt.publish).toHaveBeenCalledWith(
        "homeassistant/sensor/opencode_abc123def456/last_activity/config",
        expect.objectContaining({
          device_class: "timestamp",
        }),
        true
      );
    });

    it("should use custom discovery prefix", async () => {
      const customConfig: HaConfig = { discoveryPrefix: "custom_ha" };
      const d = new Discovery(mqtt, customConfig, sessionId, projectName);

      await d.registerDevice();

      expect(mqtt.publish).toHaveBeenCalledWith(
        expect.stringMatching(/^custom_ha\/sensor\//),
        expect.any(Object),
        true
      );
    });
  });

  describe("updateDeviceName", () => {
    it("should update device name and re-register", async () => {
      await discovery.updateDeviceName("Implementing feature X");

      // Should re-register all entities with new name
      expect(mqtt.publish).toHaveBeenCalledWith(
        expect.stringContaining("/config"),
        expect.objectContaining({
          device: expect.objectContaining({
            name: "OpenCode - my-project - Implementing feature X",
          }),
        }),
        true
      );
    });
  });

  describe("unregisterDevice", () => {
    it("should publish empty config for all entities", async () => {
      await discovery.unregisterDevice();

      // 10 entities
      expect(mqtt.publish).toHaveBeenCalledTimes(10);

      // Check empty payload
      expect(mqtt.publish).toHaveBeenCalledWith(
        "homeassistant/sensor/opencode_abc123def456/state/config",
        "",
        true
      );
    });
  });

  describe("publishState", () => {
    it("should publish string state", async () => {
      await discovery.publishState("state", "working");

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_abc123def456/state",
        "working",
        true
      );
    });

    it("should publish integer state as string", async () => {
      await discovery.publishState("tokens_input", 1000);

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_abc123def456/tokens_input",
        "1000",
        true
      );
    });

    it("should format cost with 6 decimal places", async () => {
      await discovery.publishState("cost", 0.00123456789);

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_abc123def456/cost",
        "0.001235",
        true
      );
    });

    it("should format zero cost correctly", async () => {
      await discovery.publishState("cost", 0);

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_abc123def456/cost",
        "0.000000",
        true
      );
    });
  });

  describe("publishAttributes", () => {
    it("should publish attributes as JSON", async () => {
      const attrs = { previous_state: "idle", agent: "build" };
      await discovery.publishAttributes("state", attrs);

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_abc123def456/state/attributes",
        attrs,
        true
      );
    });
  });

  describe("publishAvailable / publishUnavailable", () => {
    it("should publish online status", async () => {
      await discovery.publishAvailable();

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_abc123def456/availability",
        "online",
        true
      );
    });

    it("should publish offline status", async () => {
      await discovery.publishUnavailable();

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_abc123def456/availability",
        "offline",
        true
      );
    });
  });

  describe("publishDeviceInfo", () => {
    it("should publish device_id state and attributes", async () => {
      await discovery.publishDeviceInfo();

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_abc123def456/device_id",
        "opencode_abc123def456",
        true
      );

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_abc123def456/device_id/attributes",
        {
          command_topic: "opencode/opencode_abc123def456/command",
          response_topic: "opencode/opencode_abc123def456/response",
          state_topic_base: "opencode/opencode_abc123def456",
          device_name: "OpenCode - my-project - Untitled",
          session_id: "ses_abc123def456",
          project_name: "my-project",
        },
        true
      );
    });
  });

  describe("publishPermission", () => {
    it("should publish pending permission with attributes", async () => {
      const permission: PermissionInfo = {
        id: "perm-123",
        type: "file_write",
        title: "Write to config.json",
        sessionID: "session-1",
        messageID: "msg-1",
        callID: "call-1",
        pattern: "*.json",
        metadata: { path: "/config.json" },
      };

      await discovery.publishPermission(permission);

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_abc123def456/permission",
        "pending",
        true
      );

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_abc123def456/permission/attributes",
        {
          permission_id: "perm-123",
          type: "file_write",
          title: "Write to config.json",
          session_id: "session-1",
          message_id: "msg-1",
          call_id: "call-1",
          pattern: "*.json",
          metadata: { path: "/config.json" },
        },
        true
      );
    });

    it("should handle null callID and pattern", async () => {
      const permission: PermissionInfo = {
        id: "perm-456",
        type: "bash",
        title: "Run command",
        sessionID: "session-1",
        messageID: "msg-1",
        metadata: {},
      };

      await discovery.publishPermission(permission);

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_abc123def456/permission/attributes",
        expect.objectContaining({
          call_id: null,
          pattern: null,
        }),
        true
      );
    });

    it("should clear permission when null", async () => {
      await discovery.publishPermission(null);

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_abc123def456/permission",
        "none",
        true
      );

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_abc123def456/permission/attributes",
        {},
        true
      );
    });

    it("should sanitize non-serializable metadata", async () => {
      // Create a permission with metadata that would fail JSON.stringify
      const circularRef: Record<string, unknown> = {};
      circularRef.self = circularRef;

      const permission: PermissionInfo = {
        id: "perm-789",
        type: "bash",
        title: "Run command",
        sessionID: "session-1",
        messageID: "msg-1",
        metadata: circularRef,
      };

      await discovery.publishPermission(permission);

      // Should have error fallback
      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_abc123def456/permission/attributes",
        expect.objectContaining({
          metadata: { error: "metadata not serializable" },
        }),
        true
      );
    });
  });

  describe("getEntityKeys", () => {
    it("should return all entity keys", () => {
      const keys = Discovery.getEntityKeys();
      expect(keys).toContain("state");
      expect(keys).toContain("session_title");
      expect(keys).toContain("model");
      expect(keys).toContain("permission");
      expect(keys.length).toBe(10);
    });
  });
});
