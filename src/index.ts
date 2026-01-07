import "source-map-support/register.js";
import type { Plugin } from "@opencode-ai/plugin";
import { loadConfig, type JsonConfig } from "./config.js";
import { connectMqtt, type MqttWrapper } from "./mqtt.js";
import { Discovery, createWillConfig } from "./discovery.js";
import { StateTracker } from "./state.js";
import { CommandHandler } from "./commands.js";
import { notify } from "./notify.js";

export const HomeAssistantPlugin: Plugin = async (input) => {
  // Track initialization state
  let state: StateTracker | null = null;
  let discovery: Discovery | null = null;
  let mqttClient: MqttWrapper | null = null;
  let initialized = false;

  // Cleanup function for graceful shutdown
  const cleanup = async () => {
    if (discovery) {
      try {
        // Publish offline status before unregistering
        await discovery.publishUnavailable();
        await discovery.unregisterDevice();
      } catch {
        // Ignore errors during cleanup
      }
    }
    if (mqttClient) {
      try {
        await mqttClient.close();
      } catch {
        // Ignore errors during cleanup
      }
    }
  };

  // Register cleanup on process exit signals
  const handleExit = () => {
    cleanup().finally(() => process.exit(0));
  };
  process.once("SIGINT", handleExit);
  process.once("SIGTERM", handleExit);

  // Initialize everything in the background (non-blocking)
  const initPromise = (async () => {
    // Try to read plugin config from opencode.json
    let jsonConfig: JsonConfig | undefined;
    try {
      const configResponse = await input.client.config.get();
      if (configResponse.data) {
        const fullConfig = configResponse.data as Record<string, unknown>;
        if (fullConfig["ha-opencode"] && typeof fullConfig["ha-opencode"] === "object") {
          jsonConfig = fullConfig["ha-opencode"] as JsonConfig;
        }
      }
    } catch {
      // Config not available, will use environment variables
    }

    const config = loadConfig(jsonConfig);

    // Create LWT config for availability tracking
    // If connection drops unexpectedly, broker will publish "offline"
    const willConfig = createWillConfig(input.project);

    try {
      mqttClient = await connectMqtt(config.mqtt, willConfig);
    } catch (err) {
      notify("OpenCode HA Plugin", `Failed to connect to MQTT broker at ${config.mqtt.host}:${config.mqtt.port}`);
      return;
    }

    discovery = new Discovery(mqttClient, config.ha, input.project);
    state = new StateTracker(discovery);
    const commands = new CommandHandler(mqttClient, discovery, state, input.client);

    // Initialize plugin - device registration is deferred until valid session
    try {
      await state.initialize();
      await commands.start();
      initialized = true;
    } catch (err) {
      console.error("[ha-opencode] Failed to initialize plugin:", err);
      await mqttClient.close();
    }
  })();

  // Return hooks immediately - they'll no-op until initialization completes
  return {
    event: async ({ event }) => {
      // Send notification when session becomes idle (task complete)
      if (event.type === "session.idle") {
        notify("OpenCode", "Task complete");
      }

      // Wait for initialization on first event (with timeout)
      if (!initialized) {
        await Promise.race([
          initPromise,
          new Promise((resolve) => setTimeout(resolve, 15000)),
        ]);
      }

      if (!state || !initialized) {
        return; // Plugin not ready, skip event
      }

      try {
        await state.handleEvent(event);
      } catch (err) {
        console.error(`[ha-opencode] Error handling event '${event.type}':`, err);
      }
    },
  };
};

// Default export for OpenCode plugin loader
export default HomeAssistantPlugin;
