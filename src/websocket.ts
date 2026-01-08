import WebSocket from "ws";

export interface HAWebSocketConfig {
  url: string; // e.g., ws://homeassistant.local:8123/api/websocket
  accessToken?: string; // Long-lived access token for authentication
}

export type MessageHandler = (message: HAMessage) => void;
export type CommandHandler = (command: string, sessionId: string, data: Record<string, unknown>) => void;

export interface HAMessage {
  id?: number;
  type: string;
  [key: string]: unknown;
}

export interface HistoryResponseData {
  session_id: string;
  session_title: string;
  messages: HistoryMessageData[];
  fetched_at: string;
  since?: string;
  request_id?: string;
}

export interface HistoryMessageData {
  id: string;
  role: "user" | "assistant";
  timestamp: string;
  model?: string;
  provider?: string;
  tokens_input?: number;
  tokens_output?: number;
  cost?: number;
  parts: HistoryPartData[];
}

export interface HistoryPartData {
  type: "text" | "tool_call" | "tool_result" | "image" | "other";
  content?: string;
  tool_name?: string;
  tool_id?: string;
  tool_args?: Record<string, unknown>;
  tool_output?: string;
  tool_error?: string;
}

export interface AgentData {
  name: string;
  description?: string;
  mode: "subagent" | "primary" | "all";
}

export interface AgentsResponseData {
  session_id: string;
  agents: AgentData[];
  request_id?: string;
}

export interface HAWebSocketClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  pair(code: string, hostname: string): Promise<PairResult>;
  reconnect(instanceToken: string, hostname: string): Promise<ReconnectResult>;
  sendSessionUpdate(instanceToken: string, session: SessionUpdate): Promise<void>;
  sendSessionRemoved(instanceToken: string, sessionId: string): Promise<void>;
  sendStateResponse(instanceToken: string, sessions: SessionUpdate[]): Promise<void>;
  sendHistoryResponse(instanceToken: string, data: HistoryResponseData): Promise<void>;
  sendAgentsResponse(instanceToken: string, data: AgentsResponseData): Promise<void>;
  onCommand(handler: CommandHandler): void;
  onStateRequest(handler: () => void): void;
  onDisconnect(handler: () => void): void;
}

export interface PairResult {
  success: boolean;
  instanceId?: string;
  instanceToken?: string;
  error?: string;
}

export interface ReconnectResult {
  success: boolean;
  instanceId?: string;
  error?: string;
}

export interface SessionUpdate {
  session_id: string;
  title: string;
  state: string;
  previous_state: string | null;
  model: string;
  current_tool: string;
  tokens_input: number;
  tokens_output: number;
  cost: number;
  last_activity: string;
  agent: string | null;
  current_agent: string | null;
  hostname: string;
  error_message: string | null;
  permission: PermissionInfo | null;
}

export interface PermissionInfo {
  id: string;
  type: string;
  title: string;
  session_id: string;
  message_id: string;
  call_id?: string;
  pattern?: string;
  metadata?: Record<string, unknown>;
}

const RECONNECT_DELAY_MS = 5000;
const AUTH_TIMEOUT_MS = 10000;
const PING_INTERVAL_MS = 30000;

export function createHAWebSocketClient(config: HAWebSocketConfig): HAWebSocketClient {
  let ws: WebSocket | null = null;
  let connected = false;
  let authenticated = false;
  let messageId = 1;
  let pendingRequests = new Map<number, {
    resolve: (value: HAMessage) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  let commandHandler: CommandHandler | null = null;
  let stateRequestHandler: (() => void) | null = null;
  let disconnectHandler: (() => void) | null = null;
  let pingInterval: NodeJS.Timeout | null = null;
  let reconnecting = false;
  
  // Auth flow handlers
  let authResolve: (() => void) | null = null;
  let authReject: ((err: Error) => void) | null = null;

  function nextId(): number {
    return messageId++;
  }

  function send(message: HAMessage): Promise<HAMessage> {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      if (!authenticated && message.type !== "auth") {
        reject(new Error("Not authenticated"));
        return;
      }

      const id = nextId();
      message.id = id;

      const timeout = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`Request ${id} timed out`));
      }, AUTH_TIMEOUT_MS);

      pendingRequests.set(id, { resolve, reject, timeout });

      ws.send(JSON.stringify(message));
    });
  }

  function sendNoResponse(message: HAMessage): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    if (!authenticated && message.type !== "auth") {
      return;
    }

    const id = nextId();
    message.id = id;
    ws.send(JSON.stringify(message));
  }

  function sendRaw(message: Record<string, unknown>): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    ws.send(JSON.stringify(message));
  }

  function handleMessage(data: string): void {
    try {
      const message: HAMessage = JSON.parse(data);

      // Handle auth flow
      if (message.type === "auth_required") {
        // HA is asking for authentication
        if (config.accessToken) {
          sendRaw({ type: "auth", access_token: config.accessToken });
        } else {
          if (authReject) {
            authReject(new Error("No access token provided for authentication"));
          }
        }
        return;
      }

      if (message.type === "auth_ok") {
        authenticated = true;
        if (authResolve) {
          authResolve();
          authResolve = null;
          authReject = null;
        }
        return;
      }

      if (message.type === "auth_invalid") {
        const errorMsg = (message.message as string) || "Authentication failed";
        if (authReject) {
          authReject(new Error(errorMsg));
          authResolve = null;
          authReject = null;
        }
        return;
      }

      // Handle responses to our requests
      if (message.id && pendingRequests.has(message.id)) {
        const pending = pendingRequests.get(message.id)!;
        clearTimeout(pending.timeout);
        pendingRequests.delete(message.id);
        pending.resolve(message);
        return;
      }

      // Handle server-initiated messages
      if (message.type === "opencode/command" && commandHandler) {
        const command = message.command as string;
        const sessionId = message.session_id as string;
        const msgData = (message.data as Record<string, unknown>) || {};
        commandHandler(command, sessionId, msgData);
        return;
      }

      if (message.type === "opencode/request_state" && stateRequestHandler) {
        stateRequestHandler();
        return;
      }

      // Handle pong (keep-alive response)
      if (message.type === "pong") {
        return;
      }

    } catch {
      // Silent failure - ignore malformed messages
    }
  }

  function startPing(): void {
    if (pingInterval) {
      clearInterval(pingInterval);
    }
    pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN && authenticated) {
        sendNoResponse({ type: "ping" });
      }
    }, PING_INTERVAL_MS);
  }

  function stopPing(): void {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  }

  function cleanup(): void {
    stopPing();
    connected = false;
    authenticated = false;
    
    // Reject all pending requests
    for (const [id, pending] of pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connection closed"));
    }
    pendingRequests.clear();
    
    // Clean up auth handlers
    if (authReject) {
      authReject(new Error("Connection closed"));
      authResolve = null;
      authReject = null;
    }
  }

  return {
    async connect(): Promise<void> {
      if (ws && ws.readyState === WebSocket.OPEN) {
        return;
      }

      return new Promise((resolve, reject) => {
        ws = new WebSocket(config.url);

        const connectTimeout = setTimeout(() => {
          if (ws) {
            ws.close();
          }
          reject(new Error("Connection timeout"));
        }, AUTH_TIMEOUT_MS);

        // Set up auth flow handlers
        authResolve = () => {
          clearTimeout(connectTimeout);
          connected = true;
          startPing();
          resolve();
        };
        authReject = (err: Error) => {
          clearTimeout(connectTimeout);
          reject(err);
        };

        ws.on("open", () => {
          // Don't resolve yet - wait for auth_ok
        });

        ws.on("message", (data) => {
          handleMessage(data.toString());
        });

        ws.on("close", () => {
          cleanup();
          if (disconnectHandler && !reconnecting) {
            disconnectHandler();
          }
        });

        ws.on("error", (err) => {
          // Only log if we're not in a reconnect loop
          if (!connected) {
            clearTimeout(connectTimeout);
            reject(err);
          }
        });
      });
    },

    async disconnect(): Promise<void> {
      cleanup();
      if (ws) {
        ws.close();
        ws = null;
      }
    },

    isConnected(): boolean {
      return connected && authenticated && ws !== null && ws.readyState === WebSocket.OPEN;
    },

    async pair(code: string, hostname: string): Promise<PairResult> {
      if (!this.isConnected()) {
        return { success: false, error: "Not connected" };
      }

      try {
        const response = await send({
          type: "opencode/pair",
          code,
          hostname,
        });

        if (response.type === "result" && response.success) {
          const result = response.result as Record<string, unknown>;
          return {
            success: true,
            instanceId: result.instance_id as string,
            instanceToken: result.instance_token as string,
          };
        } else {
          return {
            success: false,
            error: (response.error as Record<string, unknown>)?.message as string || "Pairing failed",
          };
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    },

    async reconnect(instanceToken: string, hostname: string): Promise<ReconnectResult> {
      if (!this.isConnected()) {
        return { success: false, error: "Not connected" };
      }

      try {
        const response = await send({
          type: "opencode/connect",
          instance_token: instanceToken,
          hostname,
        });

        if (response.type === "result" && response.success) {
          const result = response.result as Record<string, unknown>;
          return {
            success: true,
            instanceId: result.instance_id as string,
          };
        } else {
          return {
            success: false,
            error: (response.error as Record<string, unknown>)?.message as string || "Reconnection failed",
          };
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    },

    async sendSessionUpdate(instanceToken: string, session: SessionUpdate): Promise<void> {
      if (!this.isConnected()) {
        throw new Error("Not connected");
      }

      await send({
        type: "opencode/session_update",
        instance_token: instanceToken,
        session,
      });
    },

    async sendSessionRemoved(instanceToken: string, sessionId: string): Promise<void> {
      if (!this.isConnected()) {
        throw new Error("Not connected");
      }

      await send({
        type: "opencode/session_removed",
        instance_token: instanceToken,
        session_id: sessionId,
      });
    },

    async sendStateResponse(instanceToken: string, sessions: SessionUpdate[]): Promise<void> {
      if (!this.isConnected()) {
        throw new Error("Not connected");
      }

      await send({
        type: "opencode/state_response",
        instance_token: instanceToken,
        sessions,
      });
    },

    async sendHistoryResponse(instanceToken: string, data: HistoryResponseData): Promise<void> {
      if (!this.isConnected()) {
        throw new Error("Not connected");
      }

      await send({
        type: "opencode/history_response",
        instance_token: instanceToken,
        ...data,
      });
    },

    async sendAgentsResponse(instanceToken: string, data: AgentsResponseData): Promise<void> {
      if (!this.isConnected()) {
        throw new Error("Not connected");
      }

      await send({
        type: "opencode/agents_response",
        instance_token: instanceToken,
        ...data,
      });
    },

    onCommand(handler: CommandHandler): void {
      commandHandler = handler;
    },

    onStateRequest(handler: () => void): void {
      stateRequestHandler = handler;
    },

    onDisconnect(handler: () => void): void {
      disconnectHandler = handler;
    },
  };
}

export interface ReconnectingClientCallbacks {
  onReconnected: () => void;
  onDisconnected?: () => void;
  onReconnecting?: () => void;
}

/**
 * Create a WebSocket client with automatic reconnection.
 */
export function createReconnectingClient(
  config: HAWebSocketConfig,
  instanceToken: string,
  hostname: string,
  callbacks: ReconnectingClientCallbacks | (() => void),
): HAWebSocketClient {
  // Support both old function signature and new callbacks object
  const cb: ReconnectingClientCallbacks = typeof callbacks === 'function' 
    ? { onReconnected: callbacks }
    : callbacks;
    
  const client = createHAWebSocketClient(config);
  let shouldReconnect = true;
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let hasNotifiedDisconnect = false;

  async function attemptReconnect(): Promise<void> {
    if (!shouldReconnect) return;
    
    try {
      await client.connect();
      const result = await client.reconnect(instanceToken, hostname);
      
      if (result.success) {
        hasNotifiedDisconnect = false; // Reset for next disconnect
        cb.onReconnected();
      } else {
        scheduleReconnect();
      }
    } catch {
      scheduleReconnect();
    }
  }

  function scheduleReconnect(): void {
    if (!shouldReconnect) return;
    
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    reconnectTimeout = setTimeout(attemptReconnect, RECONNECT_DELAY_MS);
  }

  client.onDisconnect(() => {
    if (shouldReconnect) {
      // Only notify once per disconnect cycle
      if (!hasNotifiedDisconnect && cb.onDisconnected) {
        hasNotifiedDisconnect = true;
        cb.onDisconnected();
      }
      scheduleReconnect();
    }
  });

  // Override disconnect to prevent reconnection
  const originalDisconnect = client.disconnect.bind(client);
  client.disconnect = async () => {
    shouldReconnect = false;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    await originalDisconnect();
  };

  return client;
}
