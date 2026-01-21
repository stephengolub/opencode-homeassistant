import "source-map-support/register.js";
import { hostname } from "os";
import { type Plugin, tool } from "@opencode-ai/plugin";
import type { Event, OpencodeClient } from "@opencode-ai/sdk";
import {
  createHAWebSocketClient,
  createReconnectingClient,
  type HAWebSocketClient,
} from "./websocket.js";
import {
  loadHAConnectionConfig,
  saveHAConnectionConfig,
  clearHAConnectionConfig,
  buildWebSocketUrl,
  type HAConnectionConfig,
} from "./ha-config.js";
import { StateTracker } from "./state.js";
import { CommandHandler } from "./commands.js";
import { notify } from "./notify.js";

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
  let commands: CommandHandler | null = null;
  let wsClient: HAWebSocketClient | null = null;
  let haConfig: HAConnectionConfig | null = null;
  let connected = false;
  let sessionInitialized = false;
  let currentSessionId: string | null = null;

  const projectName = getProjectName(input.project.worktree);
  const machineHostname = hostname();
  const sdkClient = input.client as OpencodeClient;
  const serverUrl = input.serverUrl;
  
  // Debug: log serverUrl
  const fs = require("fs");
  fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] Plugin init: serverUrl=${serverUrl.toString()}\n`);

  // Cleanup function for graceful shutdown
  const cleanup = async () => {
    if (wsClient) {
      try {
        await wsClient.disconnect();
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

  /**
   * Try to connect to Home Assistant using saved config.
   */
  async function tryConnect(): Promise<boolean> {
    haConfig = await loadHAConnectionConfig();

    if (!haConfig) {
      return false;
    }

    try {
      wsClient = createReconnectingClient(
        { url: haConfig.url, accessToken: haConfig.accessToken },
        haConfig.instanceToken,
        machineHostname,
        {
          onReconnected: () => {
            connected = true;
            notify("Home Assistant", "Reconnected");
            // Re-send current state
            if (state && wsClient && haConfig) {
              const sessions = state.getAllSessions();
              if (sessions.length > 0) {
                wsClient
                  .sendStateResponse(haConfig.instanceToken, sessions)
                  .catch(() => {});
              }
            }
          },
          onDisconnected: () => {
            connected = false;
            notify("Home Assistant", "Disconnected - reconnecting...");
          },
        }
      );

      await wsClient.connect();
      
      // Register the instance with HA (send opencode/connect)
      const reconnectResult = await wsClient.reconnect(haConfig.instanceToken, machineHostname);
      if (!reconnectResult.success) {
        throw new Error(reconnectResult.error || "Failed to register instance");
      }
      
      connected = true;
      notify("Home Assistant", "Connected");
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      notify("HA Connection Failed", errorMsg);
      wsClient = null;
      return false;
    }
  }

  /**
   * Handle pairing with Home Assistant.
   */
  async function handlePair(url: string, accessToken: string, code: string): Promise<string> {
    const wsUrl = buildWebSocketUrl(url);

    try {
      // Disconnect existing connection if any
      if (wsClient) {
        await wsClient.disconnect();
        wsClient = null;
        connected = false;
      }

      // Create new connection with access token for authentication
      wsClient = createHAWebSocketClient({ url: wsUrl, accessToken });
      await wsClient.connect();

      // Attempt pairing
      const result = await wsClient.pair(code.toUpperCase(), machineHostname);

      if (!result.success) {
        await wsClient.disconnect();
        wsClient = null;
        return `Pairing failed: ${result.error}`;
      }

      // Save the connection config
      haConfig = {
        url: wsUrl,
        accessToken,
        instanceToken: result.instanceToken!,
        instanceId: result.instanceId!,
        pairedAt: new Date().toISOString(),
      };
      await saveHAConnectionConfig(haConfig);

      connected = true;

      // Set up disconnect handler for reconnection on the existing client
      const currentToken = haConfig.instanceToken;
      let hasNotifiedDisconnect = false;
      
      wsClient.onDisconnect(() => {
        connected = false;
        
        // Only notify once per disconnect cycle
        if (!hasNotifiedDisconnect) {
          hasNotifiedDisconnect = true;
          notify("Home Assistant", "Disconnected - reconnecting...");
        }
        
        // Schedule reconnection
        setTimeout(async () => {
          try {
            wsClient = createReconnectingClient(
              { url: wsUrl, accessToken },
              currentToken,
              machineHostname,
              {
                onReconnected: () => {
                  connected = true;
                  hasNotifiedDisconnect = false;
                  notify("Home Assistant", "Reconnected");
                  if (state && haConfig) {
                    const sessions = state.getAllSessions();
                    if (sessions.length > 0 && wsClient) {
                      wsClient
                        .sendStateResponse(haConfig.instanceToken, sessions)
                        .catch(() => {});
                    }
                  }
                },
                onDisconnected: () => {
                  connected = false;
                  if (!hasNotifiedDisconnect) {
                    hasNotifiedDisconnect = true;
                    notify("Home Assistant", "Disconnected - reconnecting...");
                  }
                },
              }
            );
            await wsClient.connect();
            connected = true;
            hasNotifiedDisconnect = false;
            
            // Start command handler on new connection
            if (commands) {
              commands = new CommandHandler(wsClient, state!, sdkClient, currentToken, serverUrl);
              commands.start();
            }
          } catch {
            // Silent failure - will keep trying
          }
        }, 5000);
      });

      // Send initial state if we have a session
      if (state && sessionInitialized) {
        const sessions = state.getAllSessions();
        if (sessions.length > 0) {
          await wsClient.sendStateResponse(haConfig.instanceToken, sessions);
        }
      }

      return `Successfully paired with Home Assistant!

Instance ID: ${haConfig.instanceId}
URL: ${haConfig.url}

The connection is now active. Your OpenCode sessions will appear in Home Assistant.`;
    } catch (err) {
      if (wsClient) {
        try {
          await wsClient.disconnect();
        } catch {
          // Ignore disconnect errors
        }
        wsClient = null;
      }

      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      return `Pairing failed: ${errorMsg}`;
    }
  }

  /**
   * Handle unpairing from Home Assistant.
   */
  async function handleUnpair(): Promise<string> {
    if (wsClient) {
      await wsClient.disconnect();
      wsClient = null;
    }

    await clearHAConnectionConfig();

    connected = false;
    state = null;
    commands = null;
    haConfig = null;

    return "Disconnected from Home Assistant. Pairing cleared.";
  }

  /**
   * Get connection status.
   */
  function getStatus(): string {
    if (!haConfig) {
      return `Home Assistant: Not configured

Use the ha_pair tool to connect:
- url: Your Home Assistant URL (e.g., http://homeassistant.local:8123)
- access_token: A long-lived access token from HA (Profile > Long-Lived Access Tokens)
- code: The pairing code from the OpenCode integration in HA`;
    }

    const connStatus = connected && wsClient?.isConnected() ? "Connected" : "Disconnected";

    return `Home Assistant: ${connStatus}

URL: ${haConfig.url}
Instance ID: ${haConfig.instanceId}
Paired: ${haConfig.pairedAt}
Current Session: ${currentSessionId || "None"}`;
  }

  // Try to connect on startup (non-blocking)
  const connectPromise = tryConnect();

  /**
   * Initialize session tracking when we receive the first session event.
   */
  function initializeSession(sessionId: string): void {
    if (!wsClient || !connected || !haConfig) {
      return;
    }

    // Already initialized for this session
    if (sessionInitialized && currentSessionId === sessionId) {
      return;
    }

    currentSessionId = sessionId;

    // Create session tracking components
    state = new StateTracker(wsClient, haConfig.instanceToken, projectName);
    
    // Note: Question data is now extracted directly from tool events in state.ts
    // No polling callback needed
    
    commands = new CommandHandler(wsClient, state, sdkClient, haConfig.instanceToken, serverUrl);
    commands.start();

    sessionInitialized = true;
  }

  /**
   * Extract session ID from various event types.
   */
  function getSessionIdFromEvent(event: Event): string | null {
    const props = event.properties as Record<string, unknown>;

    // session.created / session.updated events have direct sessionID
    if (typeof props.sessionID === "string") {
      return props.sessionID;
    }

    // Most events have info object
    if (props.info && typeof props.info === "object") {
      const info = props.info as Record<string, unknown>;
      
      // message.updated has info.sessionID (not info.id - that's the message ID!)
      if (typeof info.sessionID === "string") {
        return info.sessionID;
      }
      
      // session.created / session.updated have session info with id
      // Only use info.id for session events (which start with "ses_")
      if (typeof info.id === "string" && info.id.startsWith("ses_")) {
        return info.id;
      }
    }

    return null;
  }

  // Return hooks
  return {
    // Custom tools for HA integration
    tool: {
      ha_pair: tool({
        description: "Pair OpenCode with Home Assistant. First, add the OpenCode integration in Home Assistant (Settings > Devices & Services > Add Integration > OpenCode) to get a pairing code.",
        args: {
          url: tool.schema.string().describe("Home Assistant URL (e.g., http://homeassistant.local:8123)"),
          access_token: tool.schema.string().describe("Long-lived access token from Home Assistant (Profile > Security > Long-Lived Access Tokens)"),
          code: tool.schema.string().describe("Pairing code from the OpenCode integration in Home Assistant"),
        },
        async execute(args) {
          return await handlePair(args.url, args.access_token, args.code);
        },
      }),

      ha_unpair: tool({
        description: "Disconnect and unpair from Home Assistant. This will clear the saved connection config.",
        args: {},
        async execute() {
          return await handleUnpair();
        },
      }),

      ha_status: tool({
        description: "Check the Home Assistant connection status.",
        args: {},
        async execute() {
          return getStatus();
        },
      }),
    },

    // Handle OpenCode events
    event: async ({ event }) => {
      const fs = require("fs");
      
      // Send notification when session becomes idle (task complete)
      if (event.type === "session.idle") {
        notify("OpenCode", "Task complete");
      }

      // Wait for connection attempt on first event
      if (!connected) {
        await connectPromise;
      }

      if (!wsClient || !connected || !haConfig) {
        fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] Event ${event.type}: skipped - not connected (wsClient=${!!wsClient}, connected=${connected}, haConfig=${!!haConfig})\n`);
        return; // Not connected, skip event
      }

      // Try to extract session ID from event, fall back to current session
      // (some events like message.part.updated don't include session ID)
      const sessionId = getSessionIdFromEvent(event) || currentSessionId;

      // Initialize session tracking when we get a session ID
      if (sessionId && (!sessionInitialized || currentSessionId !== sessionId)) {
        fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] Initializing session: ${sessionId}\n`);
        initializeSession(sessionId);
        // Also set the session ID in the state tracker
        if (state) {
          await state.setSessionId(sessionId, false);
        }
      }

      if (!state || !sessionInitialized) {
        fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] Event ${event.type}: skipped - session not ready (state=${!!state}, sessionInitialized=${sessionInitialized})\n`);
        return; // Session not ready, skip event
      }

      try {
        await state.handleEvent(event);
      } catch (err) {
        fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] Event ${event.type}: error - ${err}\n`);
      }
    },
  };
};

export default HomeAssistantPlugin;
