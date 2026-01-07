export interface MqttConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  clientId: string;
}

export interface HaConfig {
  discoveryPrefix: string;
}

export interface PluginConfig {
  mqtt: MqttConfig;
  ha: HaConfig;
}

// Config structure expected in opencode.json under "ha-opencode" key
export interface JsonConfig {
  mqtt?: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    clientId?: string;
  };
  ha?: {
    discoveryPrefix?: string;
  };
}

export function loadConfig(jsonConfig?: JsonConfig): PluginConfig {
  const hostname = process.env.HOSTNAME || "unknown";
  const timestamp = Date.now().toString(36);

  // Env vars take precedence over JSON config
  return {
    mqtt: {
      host: process.env.OPENCODE_MQTT_HOST || jsonConfig?.mqtt?.host || "localhost",
      port: parseInt(process.env.OPENCODE_MQTT_PORT || String(jsonConfig?.mqtt?.port || 1883), 10),
      username: process.env.OPENCODE_MQTT_USERNAME || jsonConfig?.mqtt?.username,
      password: process.env.OPENCODE_MQTT_PASSWORD || jsonConfig?.mqtt?.password,
      clientId: process.env.OPENCODE_MQTT_CLIENT_ID || jsonConfig?.mqtt?.clientId || `opencode-${hostname}-${timestamp}`,
    },
    ha: {
      discoveryPrefix: process.env.OPENCODE_HA_DISCOVERY_PREFIX || jsonConfig?.ha?.discoveryPrefix || "homeassistant",
    },
  };
}
