import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadConfig, type JsonConfig } from "../src/config.js";

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    vi.resetModules();
    process.env = { ...originalEnv };
    // Clear relevant env vars
    delete process.env.OPENCODE_MQTT_HOST;
    delete process.env.OPENCODE_MQTT_PORT;
    delete process.env.OPENCODE_MQTT_USERNAME;
    delete process.env.OPENCODE_MQTT_PASSWORD;
    delete process.env.OPENCODE_MQTT_CLIENT_ID;
    delete process.env.OPENCODE_HA_DISCOVERY_PREFIX;
    delete process.env.HOSTNAME;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("defaults", () => {
    it("should use default values when no config provided", () => {
      const config = loadConfig();

      expect(config.mqtt.host).toBe("localhost");
      expect(config.mqtt.port).toBe(1883);
      expect(config.mqtt.username).toBeUndefined();
      expect(config.mqtt.password).toBeUndefined();
      expect(config.mqtt.clientId).toMatch(/^opencode-unknown-[a-z0-9]+$/);
      expect(config.ha.discoveryPrefix).toBe("homeassistant");
    });

    it("should include hostname in default clientId", () => {
      process.env.HOSTNAME = "myhost";
      const config = loadConfig();

      expect(config.mqtt.clientId).toMatch(/^opencode-myhost-[a-z0-9]+$/);
    });
  });

  describe("JSON config", () => {
    it("should use JSON config values", () => {
      const jsonConfig: JsonConfig = {
        mqtt: {
          host: "mqtt.local",
          port: 8883,
          username: "user1",
          password: "pass1",
          clientId: "my-client",
        },
        ha: {
          discoveryPrefix: "ha",
        },
      };

      const config = loadConfig(jsonConfig);

      expect(config.mqtt.host).toBe("mqtt.local");
      expect(config.mqtt.port).toBe(8883);
      expect(config.mqtt.username).toBe("user1");
      expect(config.mqtt.password).toBe("pass1");
      expect(config.mqtt.clientId).toBe("my-client");
      expect(config.ha.discoveryPrefix).toBe("ha");
    });

    it("should handle partial JSON config", () => {
      const jsonConfig: JsonConfig = {
        mqtt: {
          host: "partial.local",
        },
      };

      const config = loadConfig(jsonConfig);

      expect(config.mqtt.host).toBe("partial.local");
      expect(config.mqtt.port).toBe(1883); // default
      expect(config.ha.discoveryPrefix).toBe("homeassistant"); // default
    });

    it("should handle empty JSON config", () => {
      const config = loadConfig({});

      expect(config.mqtt.host).toBe("localhost");
      expect(config.mqtt.port).toBe(1883);
    });
  });

  describe("environment variables", () => {
    it("should use environment variables", () => {
      process.env.OPENCODE_MQTT_HOST = "env.mqtt.local";
      process.env.OPENCODE_MQTT_PORT = "9883";
      process.env.OPENCODE_MQTT_USERNAME = "envuser";
      process.env.OPENCODE_MQTT_PASSWORD = "envpass";
      process.env.OPENCODE_MQTT_CLIENT_ID = "env-client";
      process.env.OPENCODE_HA_DISCOVERY_PREFIX = "custom_ha";

      const config = loadConfig();

      expect(config.mqtt.host).toBe("env.mqtt.local");
      expect(config.mqtt.port).toBe(9883);
      expect(config.mqtt.username).toBe("envuser");
      expect(config.mqtt.password).toBe("envpass");
      expect(config.mqtt.clientId).toBe("env-client");
      expect(config.ha.discoveryPrefix).toBe("custom_ha");
    });

    it("should override JSON config with environment variables", () => {
      process.env.OPENCODE_MQTT_HOST = "env-override.local";
      process.env.OPENCODE_MQTT_PORT = "7777";

      const jsonConfig: JsonConfig = {
        mqtt: {
          host: "json.local",
          port: 8888,
          username: "jsonuser",
        },
        ha: {
          discoveryPrefix: "json_ha",
        },
      };

      const config = loadConfig(jsonConfig);

      // Env vars should override
      expect(config.mqtt.host).toBe("env-override.local");
      expect(config.mqtt.port).toBe(7777);
      // JSON should be used where no env var
      expect(config.mqtt.username).toBe("jsonuser");
      expect(config.ha.discoveryPrefix).toBe("json_ha");
    });

    it("should handle non-numeric port gracefully", () => {
      process.env.OPENCODE_MQTT_PORT = "invalid";

      const config = loadConfig();

      // parseInt with invalid string returns NaN
      expect(config.mqtt.port).toBe(NaN);
    });
  });

  describe("clientId generation", () => {
    it("should generate unique clientId on each call", () => {
      // Mock Date.now to return incrementing values
      let now = 1000000;
      vi.spyOn(Date, "now").mockImplementation(() => now++);

      const config1 = loadConfig();
      const config2 = loadConfig();

      expect(config1.mqtt.clientId).not.toBe(config2.mqtt.clientId);

      vi.restoreAllMocks();
    });

    it("should use provided clientId over generated one", () => {
      const jsonConfig: JsonConfig = {
        mqtt: {
          clientId: "fixed-client-id",
        },
      };

      const config = loadConfig(jsonConfig);

      expect(config.mqtt.clientId).toBe("fixed-client-id");
    });
  });
});
