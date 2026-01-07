import type { OpencodeClient } from "@opencode-ai/sdk";
import type { MqttWrapper } from "./mqtt.js";
import type { Discovery } from "./discovery.js";
import type { StateTracker } from "./state.js";
import { notify } from "./notify.js";

// Command payload structures
interface PermissionCommand {
  command: "permission_response";
  permission_id: string;
  response: "once" | "always" | "reject";
}

interface PromptCommand {
  command: "prompt";
  text: string;
  session_id?: string; // Optional, uses current session if not provided
}

interface GetHistoryCommand {
  command: "get_history";
  session_id?: string; // Optional, uses current session if not provided
  request_id?: string; // Optional, echoed back in response for correlation
}

interface GetHistorySinceCommand {
  command: "get_history_since";
  since: string; // ISO 8601 timestamp
  session_id?: string;
  request_id?: string;
}

// Structured message format for history response
interface HistoryMessage {
  id: string;
  role: "user" | "assistant";
  timestamp: string;
  model?: string;
  provider?: string;
  tokens_input?: number;
  tokens_output?: number;
  cost?: number;
  parts: HistoryPart[];
}

interface HistoryPart {
  type: "text" | "tool_call" | "tool_result" | "image" | "other";
  content?: string;
  tool_name?: string;
  tool_id?: string;
  tool_args?: Record<string, unknown>;
  tool_output?: string;
  tool_error?: string;
}

interface HistoryResponse {
  type: "history";
  request_id?: string;
  session_id: string;
  session_title: string;
  messages: HistoryMessage[];
  fetched_at: string;
  since?: string; // Only present for get_history_since
}

interface Command {
  command: string;
  [key: string]: unknown;
}

export class CommandHandler {
  private readonly mqtt: MqttWrapper;
  private readonly discovery: Discovery;
  private readonly state: StateTracker;
  private readonly client: OpencodeClient;

  constructor(
    mqtt: MqttWrapper,
    discovery: Discovery,
    state: StateTracker,
    client: OpencodeClient
  ) {
    this.mqtt = mqtt;
    this.discovery = discovery;
    this.state = state;
    this.client = client;
  }

  async start(): Promise<void> {
    const commandTopic = this.discovery.getCommandTopic();
    await this.mqtt.subscribe(commandTopic, this.handleMessage.bind(this));
  }

  private handleMessage(_topic: string, payload: string): void {
    let command: Command;
    try {
      command = JSON.parse(payload);
    } catch (err) {
      console.error("[ha-opencode] Invalid command JSON:", payload);
      return;
    }

    if (!command.command) {
      console.error("[ha-opencode] Command missing 'command' field:", payload);
      return;
    }

    // Trigger Kitty terminal alert for incoming command
    notify(
      "HA Command Received",
      `Command: ${command.command}`
    );

    // Handle command asynchronously
    this.processCommand(command).catch((err) => {
      console.error("[ha-opencode] Error processing command:", err);
    });
  }

  private async processCommand(command: Command): Promise<void> {
    switch (command.command) {
      case "permission_response":
        await this.handlePermissionResponse(command as unknown as PermissionCommand);
        break;
      case "prompt":
        await this.handlePrompt(command as unknown as PromptCommand);
        break;
      case "get_history":
        await this.handleGetHistory(command as unknown as GetHistoryCommand);
        break;
      case "get_history_since":
        await this.handleGetHistorySince(command as unknown as GetHistorySinceCommand);
        break;
      default:
        notify("Unknown Command", `Unrecognized: ${command.command}`);
    }
  }

  private async handlePrompt(command: PromptCommand): Promise<void> {
    if (!command.text || command.text.trim() === "") {
      notify("Prompt Error", "Empty prompt text");
      return;
    }

    // Get session ID - use provided one or fall back to current session
    const sessionId = command.session_id || this.state.getCurrentSessionId();

    if (!sessionId) {
      notify("Prompt Error", "No active session");
      return;
    }

    notify("Prompt Received", command.text.substring(0, 50) + (command.text.length > 50 ? "..." : ""));

    try {
      await this.client.session.prompt({
        path: { id: sessionId },
        body: {
          parts: [{ type: "text", text: command.text }],
        },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      notify("Prompt Failed", errorMsg);
      console.error("[ha-opencode] Failed to send prompt:", err);
    }
  }

  private async handleGetHistory(command: GetHistoryCommand): Promise<void> {
    const sessionId = command.session_id || this.state.getCurrentSessionId();

    if (!sessionId) {
      notify("History Error", "No active session");
      return;
    }

    try {
      const history = await this.fetchSessionHistory(sessionId);
      const response: HistoryResponse = {
        type: "history",
        request_id: command.request_id,
        session_id: sessionId,
        session_title: history.title,
        messages: history.messages,
        fetched_at: new Date().toISOString(),
      };

      await this.mqtt.publish(this.discovery.getResponseTopic(), response, false);
      notify("History Sent", `${history.messages.length} messages`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      notify("History Failed", errorMsg);
      console.error("[ha-opencode] Failed to fetch history:", err);
    }
  }

  private async handleGetHistorySince(command: GetHistorySinceCommand): Promise<void> {
    const sessionId = command.session_id || this.state.getCurrentSessionId();

    if (!sessionId) {
      notify("History Error", "No active session");
      return;
    }

    if (!command.since) {
      notify("History Error", "Missing 'since' timestamp");
      return;
    }

    const sinceDate = new Date(command.since);
    if (isNaN(sinceDate.getTime())) {
      notify("History Error", "Invalid 'since' timestamp");
      return;
    }

    try {
      const history = await this.fetchSessionHistory(sessionId, sinceDate);
      const response: HistoryResponse = {
        type: "history",
        request_id: command.request_id,
        session_id: sessionId,
        session_title: history.title,
        messages: history.messages,
        fetched_at: new Date().toISOString(),
        since: command.since,
      };

      await this.mqtt.publish(this.discovery.getResponseTopic(), response, false);
      notify("History Sent", `${history.messages.length} messages since ${sinceDate.toLocaleTimeString()}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      notify("History Failed", errorMsg);
      console.error("[ha-opencode] Failed to fetch history:", err);
    }
  }

  private async fetchSessionHistory(sessionId: string, since?: Date): Promise<{ title: string; messages: HistoryMessage[] }> {
    // Get session info
    const sessionResult = await this.client.session.get({
      path: { id: sessionId },
    });
    const sessionTitle = sessionResult.data?.title || "Untitled";

    // Get all messages
    const messagesResult = await this.client.session.messages({
      path: { id: sessionId },
    });

    const messages: HistoryMessage[] = [];

    for (const msg of messagesResult.data || []) {
      const info = msg.info;
      const parts = msg.parts || [];

      // Get timestamp from the message - use created or updated time
      const timestamp = info.time?.created || new Date().toISOString();
      const msgDate = new Date(timestamp);

      // Filter by since date if provided
      if (since && msgDate <= since) {
        continue;
      }

      // Convert parts to our structured format
      const historyParts: HistoryPart[] = [];
      for (const part of parts) {
        if (part.type === "text") {
          historyParts.push({
            type: "text",
            content: part.text || "",
          });
        } else if (part.type === "tool") {
          // Tool call from assistant - safely access state properties
          const toolState = part.state as Record<string, unknown> | undefined;
          historyParts.push({
            type: "tool_call",
            tool_name: part.tool || "unknown",
            tool_id: part.id,
            tool_args: (part as unknown as Record<string, unknown>).args as Record<string, unknown> | undefined,
            tool_output: toolState?.output as string | undefined,
            tool_error: toolState?.error as string | undefined,
          });
        } else if (part.type === "file") {
          historyParts.push({
            type: "image",
            content: part.filename || part.url || "",
          });
        } else {
          historyParts.push({
            type: "other",
            content: JSON.stringify(part),
          });
        }
      }

      const historyMsg: HistoryMessage = {
        id: info.id,
        role: info.role as "user" | "assistant",
        timestamp: String(timestamp),
        parts: historyParts,
      };

      // Add assistant-specific metadata
      if (info.role === "assistant") {
        historyMsg.model = info.modelID;
        historyMsg.provider = info.providerID;
        historyMsg.tokens_input = info.tokens?.input ? Number(info.tokens.input) : undefined;
        historyMsg.tokens_output = info.tokens?.output ? Number(info.tokens.output) : undefined;
        historyMsg.cost = info.cost ? Number(info.cost) : undefined;
      }

      messages.push(historyMsg);
    }

    return { title: sessionTitle, messages };
  }

  private async handlePermissionResponse(command: PermissionCommand): Promise<void> {
    const pendingPermission = this.state.getPendingPermission();

    if (!pendingPermission) {
      notify("Permission Error", "No pending permission");
      return;
    }

    // Validate permission ID matches
    if (command.permission_id && command.permission_id !== pendingPermission.id) {
      notify("Permission Error", "Permission ID mismatch");
      return;
    }

    // Validate response value
    const validResponses = ["once", "always", "reject"];
    if (!validResponses.includes(command.response)) {
      notify("Permission Error", `Invalid response: ${command.response}`);
      return;
    }

    try {
      await this.client.postSessionIdPermissionsPermissionId({
        path: {
          id: pendingPermission.sessionID,
          permissionID: pendingPermission.id,
        },
        body: {
          response: command.response,
        },
      });

      // Notify user of successful permission response
      const responseLabel = command.response === "once" ? "Approved (once)" 
        : command.response === "always" ? "Approved (always)" 
        : "Rejected";
      notify("Permission Response", responseLabel);
      
      await this.state.clearPermission();
    } catch (err) {
      notify("Permission Error", "Failed to send response");
      console.error("[ha-opencode] Failed to send permission response:", err);
    }
  }
}
