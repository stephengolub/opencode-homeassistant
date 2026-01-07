import type { Project } from "@opencode-ai/sdk";
import type { MqttWrapper, MqttWillConfig } from "./mqtt.js";
import type { HaConfig } from "./config.js";

/**
 * Generate the availability topic for LWT configuration.
 * This can be called before Discovery is instantiated.
 */
export function getAvailabilityTopicForProject(project: Project): string {
  const projectName = project.worktree.split("/").pop() || "unknown";
  const deviceId = `opencode_${projectName.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase()}`;
  return `opencode/${deviceId}/availability`;
}

/**
 * Create MQTT LWT (Last Will and Testament) config for availability tracking.
 */
export function createWillConfig(project: Project): MqttWillConfig {
  return {
    topic: getAvailabilityTopicForProject(project),
    payload: "offline",
    retain: true,
  };
}

export interface DeviceInfo {
  identifiers: string[];
  name: string;
  manufacturer: string;
  model: string;
  sw_version: string;
}

interface EntityConfig {
  name: string;
  unique_id: string;
  state_topic: string;
  device: DeviceInfo;
  icon?: string;
  unit_of_measurement?: string;
  state_class?: string;
  device_class?: string;
  value_template?: string;
  json_attributes_topic?: string;
  availability_topic?: string;
  payload_available?: string;
  payload_not_available?: string;
}

const ENTITY_DEFINITIONS = [
  {
    key: "device_id",
    name: "Device ID",
    icon: "mdi:identifier",
    hasAttributes: true,
  },
  {
    key: "state",
    name: "State",
    icon: "mdi:state-machine",
    hasAttributes: true,
  },
  {
    key: "session_title",
    name: "Session",
    icon: "mdi:message-text",
  },
  {
    key: "model",
    name: "Model",
    icon: "mdi:brain",
  },
  {
    key: "current_tool",
    name: "Current Tool",
    icon: "mdi:tools",
  },
  {
    key: "tokens_input",
    name: "Input Tokens",
    icon: "mdi:arrow-right-bold",
    unit: "tokens",
    state_class: "measurement",
  },
  {
    key: "tokens_output",
    name: "Output Tokens",
    icon: "mdi:arrow-left-bold",
    unit: "tokens",
    state_class: "measurement",
  },
  {
    key: "cost",
    name: "Cost",
    icon: "mdi:currency-usd",
    unit: "USD",
    state_class: "total_increasing",
  },
  {
    key: "last_activity",
    name: "Last Activity",
    icon: "mdi:clock-outline",
    device_class: "timestamp",
  },
  {
    key: "permission",
    name: "Permission Request",
    icon: "mdi:shield-alert",
    hasAttributes: true,
  },
] as const;

export type EntityKey = (typeof ENTITY_DEFINITIONS)[number]["key"];

export interface PermissionInfo {
  id: string;
  type: string;
  title: string;
  sessionID: string;
  messageID: string;
  callID?: string;
  pattern?: string | string[];
  metadata: Record<string, unknown>;
}

export class Discovery {
  private readonly mqtt: MqttWrapper;
  private readonly haConfig: HaConfig;
  readonly deviceId: string;
  private readonly device: DeviceInfo;
  private readonly stateTopicBase: string;

  constructor(mqtt: MqttWrapper, haConfig: HaConfig, project: Project) {
    this.mqtt = mqtt;
    this.haConfig = haConfig;

    // Extract project name from worktree path (e.g., "/Users/foo/code/myproject" -> "myproject")
    const projectName = project.worktree.split("/").pop() || "unknown";
    
    // Create a stable device ID from project name (derived from worktree path)
    // This is more reliable than project.id which may be a UUID or empty
    this.deviceId = `opencode_${this.sanitizeId(projectName)}`;

    this.device = {
      identifiers: [this.deviceId],
      name: `OpenCode - ${projectName}`,
      manufacturer: "OpenCode",
      model: "AI Coding Assistant",
      sw_version: project.id || projectName,
    };

    this.stateTopicBase = `opencode/${this.deviceId}`;
  }

  private sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  }

  async registerDevice(): Promise<void> {
    for (const entity of ENTITY_DEFINITIONS) {
      await this.registerEntity(entity);
    }
  }

  private async registerEntity(entity: (typeof ENTITY_DEFINITIONS)[number]): Promise<void> {
    const uniqueId = `${this.deviceId}_${entity.key}`;
    const configTopic = `${this.haConfig.discoveryPrefix}/sensor/${this.deviceId}/${entity.key}/config`;

    const config: EntityConfig = {
      name: entity.name,
      unique_id: uniqueId,
      state_topic: this.getStateTopic(entity.key),
      device: this.device,
      // Availability tracking - entities show as unavailable when plugin disconnects
      availability_topic: this.getAvailabilityTopic(),
      payload_available: "online",
      payload_not_available: "offline",
    };

    if (entity.icon) {
      config.icon = entity.icon;
    }
    if ("unit" in entity && entity.unit) {
      config.unit_of_measurement = entity.unit;
    }
    if ("state_class" in entity && entity.state_class) {
      config.state_class = entity.state_class;
    }
    if ("device_class" in entity && entity.device_class) {
      config.device_class = entity.device_class;
    }
    if ("hasAttributes" in entity && entity.hasAttributes) {
      config.json_attributes_topic = this.getAttributesTopic(entity.key);
    }

    await this.mqtt.publish(configTopic, config, true);
  }

  getStateTopic(key: EntityKey): string {
    return `${this.stateTopicBase}/${key}`;
  }

  getAttributesTopic(key: EntityKey): string {
    return `${this.stateTopicBase}/${key}/attributes`;
  }

  getCommandTopic(): string {
    return `${this.stateTopicBase}/command`;
  }

  getResponseTopic(): string {
    return `${this.stateTopicBase}/response`;
  }

  getAvailabilityTopic(): string {
    return `${this.stateTopicBase}/availability`;
  }

  /**
   * Publish online status. Call this after device registration.
   */
  async publishAvailable(): Promise<void> {
    await this.mqtt.publish(this.getAvailabilityTopic(), "online", true);
  }

  /**
   * Publish offline status. Call this before graceful shutdown.
   */
  async publishUnavailable(): Promise<void> {
    await this.mqtt.publish(this.getAvailabilityTopic(), "offline", true);
  }

  async publishState(key: EntityKey, value: string | number): Promise<void> {
    const topic = this.getStateTopic(key);
    let payload: string;
    if (typeof value === "number") {
      // Use decimal formatting only for cost, integers for token counts
      payload = key === "cost" ? value.toFixed(6) : String(value);
    } else {
      payload = value;
    }
    await this.mqtt.publish(topic, payload, true);
  }

  async publishAttributes(key: EntityKey, attributes: Record<string, unknown>): Promise<void> {
    const topic = this.getAttributesTopic(key);
    await this.mqtt.publish(topic, attributes, true);
  }

  async publishDeviceInfo(): Promise<void> {
    await this.publishState("device_id", this.deviceId);
    await this.publishAttributes("device_id", {
      command_topic: this.getCommandTopic(),
      response_topic: this.getResponseTopic(),
      state_topic_base: this.stateTopicBase,
      device_name: this.device.name,
    });
  }

  async publishPermission(permission: PermissionInfo | null): Promise<void> {
    if (permission) {
      await this.publishState("permission", "pending");
      // Sanitize metadata to ensure it's JSON-serializable (SDK may return Decimal objects)
      let safeMetadata: Record<string, unknown> = {};
      try {
        safeMetadata = JSON.parse(JSON.stringify(permission.metadata));
      } catch {
        safeMetadata = { error: "metadata not serializable" };
      }
      await this.publishAttributes("permission", {
        permission_id: permission.id,
        type: permission.type,
        title: permission.title,
        session_id: permission.sessionID,
        message_id: permission.messageID,
        call_id: permission.callID || null,
        pattern: permission.pattern || null,
        metadata: safeMetadata,
      });
    } else {
      await this.publishState("permission", "none");
      await this.publishAttributes("permission", {});
    }
  }

  async unregisterDevice(): Promise<void> {
    // Publish empty config to remove entities
    for (const entity of ENTITY_DEFINITIONS) {
      const configTopic = `${this.haConfig.discoveryPrefix}/sensor/${this.deviceId}/${entity.key}/config`;
      await this.mqtt.publish(configTopic, "", true);
    }
  }
}
