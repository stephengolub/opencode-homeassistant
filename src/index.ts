import "source-map-support/register.js";
import type { Plugin } from "@opencode-ai/plugin";
import type { Event } from "@opencode-ai/sdk";
import { loadConfig, type JsonConfig, type PluginConfig } from "./config.js";
import { connectMqtt, type MqttWrapper } from "./mqtt.js";
import { Discovery } from "./discovery.js";
import { StateTracker } from "./state.js";
import { CommandHandler } from "./commands.js";
import { notify } from "./notify.js";
import { runCleanupInBackground } from "./cleanup.js";

/**
 * Extract project name from worktree path.
 * e.g., "/Users/foo/code/myproject" -> "myproject"
 */
function getProjectName(worktree: string): string {
  return worktree.split("/").pop() || "unknown";
}

export const HomeAssistantPlugin: Plugin = async (input) => {
  // Track initialization state
  let state: StateTracker | null = null;
  let discovery: Discovery | null = null;
  let commands: CommandHandler | null = null;
  let mqttClient: MqttWrapper | null = null;
  let config: PluginConfig | null = null;
  let mqttConnected = false;
  let sessionInitialized = false;
  let currentSessionId: string | null = null;

  const projectName = getProjectName(input.project.worktree);

  // Cleanup function for graceful shutdown
  const cleanup = async () => {
    if (discovery) {
      try {
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

  // Connect to MQTT in the background (non-blocking)
  const mqttPromise = (async () => {
    // Try to read plugin config from opencode.json
    let jsonConfig: JsonConfig | undefined;
    try {
      const configResponse = await input.client.config.get();
      if (configResponse.data) {
        const fullConfig = configResponse.data as Record<string, unknown>;
        if (
          fullConfig["ha-opencode"] &&
          typeof fullConfig["ha-opencode"] === "object"
        ) {
          jsonConfig = fullConfig["ha-opencode"] as JsonConfig;
        }
      }
    } catch {
      // Config not available, will use environment variables
    }

    config = loadConfig(jsonConfig);

    // Connect to MQTT without LWT initially
    // LWT will be set up per-session once we have a session ID
    try {
      mqttClient = await connectMqtt(config.mqtt);
      mqttConnected = true;

      // Run background cleanup of stale sessions
      runCleanupInBackground(mqttClient, {
        maxAgeDays: 7,
        haConfig: config.ha,
      });
    } catch (err) {
      notify(
        "OpenCode HA Plugin",
        `Failed to connect to MQTT broker at ${config.mqtt.host}:${config.mqtt.port}`
      );
    }
  })();

  /**
   * Initialize session-specific components when we receive the first session event.
   * This creates Discovery, StateTracker, and CommandHandler for the session.
   */
  async function initializeSession(sessionId: string): Promise<void> {
    if (!mqttClient || !config) {
      return;
    }

    // Already initialized for this session
    if (sessionInitialized && currentSessionId === sessionId) {
      return;
    }

    // Clean up previous session if switching to a different session
    if (sessionInitialized && currentSessionId !== sessionId && discovery) {
      try {
        // Mark old session as unavailable before switching
        await discovery.publishUnavailable();
      } catch {
        // Ignore cleanup errors
      }
    }

    currentSessionId = sessionId;

    // Create session-specific Discovery with session ID
    discovery = new Discovery(mqttClient, config.ha, sessionId, projectName);
    state = new StateTracker(discovery);
    commands = new CommandHandler(
      mqttClient,
      discovery,
      state,
      input.client,
      config.ha
    );

    try {
      await state.initialize();
      await commands.start();
      sessionInitialized = true;
    } catch (err) {
      console.error("[ha-opencode] Failed to initialize session:", err);
      sessionInitialized = false;
    }
  }

  /**
   * Extract session ID from event if available.
   */
  function getSessionIdFromEvent(event: Event): string | null {
    const props = event.properties as Record<string, unknown>;

    // session.created / session.updated have info.id
    if (props.info && typeof props.info === "object") {
      const info = props.info as Record<string, unknown>;
      if (typeof info.id === "string") {
        return info.id;
      }
    }

    // permission.updated has sessionID
    if (typeof props.sessionID === "string") {
      return props.sessionID;
    }

    // message.updated has info.sessionID
    if (props.info && typeof props.info === "object") {
      const info = props.info as Record<string, unknown>;
      if (typeof info.sessionID === "string") {
        return info.sessionID;
      }
    }

    return null;
  }

  // Return hooks immediately - they'll no-op until MQTT connects
  return {
    event: async ({ event }) => {
      // Send notification when session becomes idle (task complete)
      if (event.type === "session.idle") {
        notify("OpenCode", "Task complete");
      }

      // Wait for MQTT connection on first event (with timeout)
      if (!mqttConnected) {
        await Promise.race([
          mqttPromise,
          new Promise((resolve) => setTimeout(resolve, 15000)),
        ]);
      }

      if (!mqttClient || !mqttConnected) {
        return; // MQTT not ready, skip event
      }

      // Try to extract session ID from event
      const sessionId = getSessionIdFromEvent(event);

      // Initialize session components when we get a new session ID
      // This handles both first-time initialization and session resumption/switching
      if (sessionId && (!sessionInitialized || currentSessionId !== sessionId)) {
        await initializeSession(sessionId);
      }

      if (!state || !sessionInitialized) {
        return; // Session not ready, skip event
      }

      try {
        await state.handleEvent(event);
      } catch (err) {
        console.error(
          `[ha-opencode] Error handling event '${event.type}':`,
          err
        );
      }
    },
  };
};

// Default export for OpenCode plugin loader
export default HomeAssistantPlugin;
