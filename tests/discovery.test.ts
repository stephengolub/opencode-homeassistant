import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  Discovery,
  getAvailabilityTopicForProject,
  createWillConfig,
  type PermissionInfo,
} from "../src/discovery.js";
import type { MqttWrapper } from "../src/mqtt.js";
import type { HaConfig } from "../src/config.js";
import type { Project } from "@opencode-ai/sdk";

// Mock MQTT
function createMockMqtt(): MqttWrapper {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as MqttWrapper;
}

// Mock Project
function createMockProject(overrides?: Partial<Project>): Project {
  return {
    id: "project-123",
    worktree: "/Users/test/code/my-project",
    ...overrides,
  } as Project;
}

// Default HA config
const defaultHaConfig: HaConfig = {
  discoveryPrefix: "homeassistant",
};

describe("getAvailabilityTopicForProject", () => {
  it("should generate availability topic from worktree path", () => {
    const project = createMockProject({ worktree: "/Users/test/code/my-project" });
    const topic = getAvailabilityTopicForProject(project);

    expect(topic).toBe("opencode/opencode_my-project/availability");
  });

  it("should sanitize project name", () => {
    const project = createMockProject({ worktree: "/path/to/My Project Name" });
    const topic = getAvailabilityTopicForProject(project);

    expect(topic).toBe("opencode/opencode_my_project_name/availability");
  });

  it("should handle worktree with no path separators", () => {
    const project = createMockProject({ worktree: "standalone" });
    const topic = getAvailabilityTopicForProject(project);

    expect(topic).toBe("opencode/opencode_standalone/availability");
  });

  it("should use 'unknown' for empty worktree", () => {
    const project = createMockProject({ worktree: "" });
    const topic = getAvailabilityTopicForProject(project);

    expect(topic).toBe("opencode/opencode_unknown/availability");
  });
});

describe("createWillConfig", () => {
  it("should create LWT config with offline payload", () => {
    const project = createMockProject({ worktree: "/path/to/test-project" });
    const willConfig = createWillConfig(project);

    expect(willConfig).toEqual({
      topic: "opencode/opencode_test-project/availability",
      payload: "offline",
      retain: true,
    });
  });
});

describe("Discovery", () => {
  let mqtt: MqttWrapper;
  let discovery: Discovery;
  let project: Project;

  beforeEach(() => {
    vi.clearAllMocks();
    mqtt = createMockMqtt();
    project = createMockProject();
    discovery = new Discovery(mqtt, defaultHaConfig, project);
  });

  describe("constructor", () => {
    it("should set deviceId from worktree project name", () => {
      expect(discovery.deviceId).toBe("opencode_my-project");
    });

    it("should sanitize special characters in project name", () => {
      const specialProject = createMockProject({ worktree: "/path/My Project (Test)" });
      const d = new Discovery(mqtt, defaultHaConfig, specialProject);

      expect(d.deviceId).toBe("opencode_my_project__test_");
    });

    it("should handle project with trailing slash", () => {
      const trailingSlash = createMockProject({ worktree: "/path/to/project/" });
      const d = new Discovery(mqtt, defaultHaConfig, trailingSlash);

      // Empty string after split, falls back to "unknown"
      expect(d.deviceId).toBe("opencode_unknown");
    });
  });

  describe("topic generation", () => {
    it("should generate correct state topic", () => {
      expect(discovery.getStateTopic("state")).toBe("opencode/opencode_my-project/state");
      expect(discovery.getStateTopic("model")).toBe("opencode/opencode_my-project/model");
    });

    it("should generate correct attributes topic", () => {
      expect(discovery.getAttributesTopic("state")).toBe(
        "opencode/opencode_my-project/state/attributes"
      );
    });

    it("should generate correct command topic", () => {
      expect(discovery.getCommandTopic()).toBe("opencode/opencode_my-project/command");
    });

    it("should generate correct response topic", () => {
      expect(discovery.getResponseTopic()).toBe("opencode/opencode_my-project/response");
    });

    it("should generate correct availability topic", () => {
      expect(discovery.getAvailabilityTopic()).toBe(
        "opencode/opencode_my-project/availability"
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
        "homeassistant/sensor/opencode_my-project/state/config",
        expect.objectContaining({
          name: "State",
          unique_id: "opencode_my-project_state",
          state_topic: "opencode/opencode_my-project/state",
          icon: "mdi:state-machine",
        }),
        true
      );
    });

    it("should include device info in entity config", async () => {
      await discovery.registerDevice();

      expect(mqtt.publish).toHaveBeenCalledWith(
        expect.stringContaining("/config"),
        expect.objectContaining({
          device: {
            identifiers: ["opencode_my-project"],
            name: "OpenCode - my-project",
            manufacturer: "OpenCode",
            model: "AI Coding Assistant",
            sw_version: "project-123",
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
          availability_topic: "opencode/opencode_my-project/availability",
          payload_available: "online",
          payload_not_available: "offline",
        }),
        true
      );
    });

    it("should include json_attributes_topic for entities with attributes", async () => {
      await discovery.registerDevice();

      // state entity has attributes
      expect(mqtt.publish).toHaveBeenCalledWith(
        "homeassistant/sensor/opencode_my-project/state/config",
        expect.objectContaining({
          json_attributes_topic: "opencode/opencode_my-project/state/attributes",
        }),
        true
      );
    });

    it("should include unit_of_measurement for token entities", async () => {
      await discovery.registerDevice();

      expect(mqtt.publish).toHaveBeenCalledWith(
        "homeassistant/sensor/opencode_my-project/tokens_input/config",
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
        "homeassistant/sensor/opencode_my-project/last_activity/config",
        expect.objectContaining({
          device_class: "timestamp",
        }),
        true
      );
    });

    it("should use custom discovery prefix", async () => {
      const customConfig: HaConfig = { discoveryPrefix: "custom_ha" };
      const d = new Discovery(mqtt, customConfig, project);

      await d.registerDevice();

      expect(mqtt.publish).toHaveBeenCalledWith(
        expect.stringMatching(/^custom_ha\/sensor\//),
        expect.any(Object),
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
        "homeassistant/sensor/opencode_my-project/state/config",
        "",
        true
      );
    });
  });

  describe("publishState", () => {
    it("should publish string state", async () => {
      await discovery.publishState("state", "working");

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_my-project/state",
        "working",
        true
      );
    });

    it("should publish integer state as string", async () => {
      await discovery.publishState("tokens_input", 1000);

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_my-project/tokens_input",
        "1000",
        true
      );
    });

    it("should format cost with 6 decimal places", async () => {
      await discovery.publishState("cost", 0.00123456789);

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_my-project/cost",
        "0.001235",
        true
      );
    });

    it("should format zero cost correctly", async () => {
      await discovery.publishState("cost", 0);

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_my-project/cost",
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
        "opencode/opencode_my-project/state/attributes",
        attrs,
        true
      );
    });
  });

  describe("publishAvailable / publishUnavailable", () => {
    it("should publish online status", async () => {
      await discovery.publishAvailable();

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_my-project/availability",
        "online",
        true
      );
    });

    it("should publish offline status", async () => {
      await discovery.publishUnavailable();

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_my-project/availability",
        "offline",
        true
      );
    });
  });

  describe("publishDeviceInfo", () => {
    it("should publish device_id state and attributes", async () => {
      await discovery.publishDeviceInfo();

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_my-project/device_id",
        "opencode_my-project",
        true
      );

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_my-project/device_id/attributes",
        {
          command_topic: "opencode/opencode_my-project/command",
          response_topic: "opencode/opencode_my-project/response",
          state_topic_base: "opencode/opencode_my-project",
          device_name: "OpenCode - my-project",
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
        "opencode/opencode_my-project/permission",
        "pending",
        true
      );

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_my-project/permission/attributes",
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
        "opencode/opencode_my-project/permission/attributes",
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
        "opencode/opencode_my-project/permission",
        "none",
        true
      );

      expect(mqtt.publish).toHaveBeenCalledWith(
        "opencode/opencode_my-project/permission/attributes",
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
        "opencode/opencode_my-project/permission/attributes",
        expect.objectContaining({
          metadata: { error: "metadata not serializable" },
        }),
        true
      );
    });
  });

  describe("edge cases", () => {
    it("should use project.id for sw_version when available", () => {
      const projectWithId = createMockProject({
        id: "custom-version-123",
        worktree: "/path/to/test",
      });
      const d = new Discovery(mqtt, defaultHaConfig, projectWithId);

      // Need to register to check device info
      d.registerDevice();

      expect(mqtt.publish).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          device: expect.objectContaining({
            sw_version: "custom-version-123",
          }),
        }),
        true
      );
    });

    it("should use project name for sw_version when id is empty", async () => {
      const projectNoId = createMockProject({
        id: "",
        worktree: "/path/to/fallback-project",
      });
      const d = new Discovery(mqtt, defaultHaConfig, projectNoId);

      await d.registerDevice();

      expect(mqtt.publish).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          device: expect.objectContaining({
            sw_version: "fallback-project",
          }),
        }),
        true
      );
    });
  });
});
