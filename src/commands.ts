import type { OpencodeClient } from "@opencode-ai/sdk";
import type { 
  HAWebSocketClient, 
  HistoryResponseData, 
  HistoryMessageData, 
  HistoryPartData, 
  AgentsResponseData,
  AgentData 
} from "./websocket.js";
import type { StateTracker } from "./state.js";
import { notify } from "./notify.js";

// Command payload structures
interface PermissionCommand {
  permission_id: string;
  response: "once" | "always" | "reject";
}

interface PromptCommand {
  text: string;
  agent?: string;
}

interface GetAgentsCommand {
  request_id?: string;
}

interface GetHistoryCommand {
  since?: string;
  limit?: number;
  request_id?: string;
}

interface RespondQuestionCommand {
  answers: string[][];  // Array of arrays - one per question, each containing selected labels
}

export class CommandHandler {
  private readonly wsClient: HAWebSocketClient;
  private readonly state: StateTracker;
  private readonly client: OpencodeClient;
  private readonly instanceToken: string;
  private readonly serverUrl: URL;

  constructor(
    wsClient: HAWebSocketClient,
    state: StateTracker,
    client: OpencodeClient,
    instanceToken: string,
    serverUrl: URL
  ) {
    this.wsClient = wsClient;
    this.state = state;
    this.client = client;
    this.instanceToken = instanceToken;
    this.serverUrl = serverUrl;
  }

  /**
   * Start listening for commands from Home Assistant.
   */
  start(): void {
    this.wsClient.onCommand(this.handleCommand.bind(this));
    this.wsClient.onStateRequest(this.handleStateRequest.bind(this));
  }

  private handleCommand(
    command: string,
    sessionId: string,
    data: Record<string, unknown>
  ): void {
    // Trigger notification for incoming command (skip noisy history requests)
    if (!["get_history", "get_history_since", "get_agents"].includes(command)) {
      notify("HA Command Received", `Command: ${command}`);
    }

    // Handle command asynchronously
    this.processCommand(command, sessionId, data).catch(() => {
      // Silent failure - errors are handled in processCommand
    });
  }

  private async processCommand(
    command: string,
    sessionId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    switch (command) {
      case "respond_permission":
        await this.handlePermissionResponse(
          sessionId,
          data as unknown as PermissionCommand
        );
        break;
      case "send_prompt":
        await this.handlePrompt(sessionId, data as unknown as PromptCommand);
        break;
      case "get_history":
        await this.handleGetHistory(
          sessionId,
          data as unknown as GetHistoryCommand
        );
        break;
      case "get_agents":
        await this.handleGetAgents(
          sessionId,
          data as unknown as GetAgentsCommand
        );
        break;
      case "respond_question":
        await this.handleRespondQuestion(
          sessionId,
          data as unknown as RespondQuestionCommand
        );
        break;
      default:
        notify("Unknown Command", `Unrecognized: ${command}`);
    }
  }

  /**
   * Handle state request from HA - send all current sessions.
   */
  private handleStateRequest(): void {
    const sessions = this.state.getAllSessions();
    this.wsClient
      .sendStateResponse(this.instanceToken, sessions)
      .catch(() => {
        // Silent failure
      });
  }

  private async handlePrompt(
    sessionId: string,
    command: PromptCommand
  ): Promise<void> {
    const fs = require("fs");
    fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] handlePrompt called: sessionId=${sessionId}, text="${command.text?.substring(0, 50)}"\n`);
    
    if (!command.text || command.text.trim() === "") {
      notify("Prompt Error", "Empty prompt text");
      return;
    }

    // Use provided session ID or fall back to current
    const targetSessionId = sessionId || this.state.getCurrentSessionId();
    fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] targetSessionId=${targetSessionId}, currentSessionId=${this.state.getCurrentSessionId()}\n`);

    if (!targetSessionId) {
      notify("Prompt Error", "No active session");
      return;
    }

    const agentInfo = command.agent ? ` [${command.agent}]` : "";
    notify(
      "Prompt Received",
      command.text.substring(0, 50) +
        (command.text.length > 50 ? "..." : "") +
        agentInfo
    );

    try {
      fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] Calling client.session.prompt for session ${targetSessionId}\n`);
      const result = await this.client.session.prompt({
        path: { id: targetSessionId },
        body: {
          agent: command.agent,
          parts: [{ type: "text", text: command.text }],
        },
      });
      fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] Prompt result: ${JSON.stringify(result)}\n`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] Prompt error: ${errorMsg}\n`);
      notify("Prompt Failed", errorMsg);
    }
  }

  private async handleGetAgents(
    sessionId: string,
    command: GetAgentsCommand
  ): Promise<void> {
    try {
      const result = await this.client.app.agents();

      if (!result.data) {
        return;
      }

      const agents: AgentData[] = result.data.map((agent) => ({
        name: agent.name,
        description: agent.description,
        mode: agent.mode,
      }));

      const responseData: AgentsResponseData = {
        session_id: sessionId || this.state.getCurrentSessionId() || "",
        agents,
        request_id: command.request_id,
      };

      await this.wsClient.sendAgentsResponse(this.instanceToken, responseData);
    } catch {
      // Silent failure
    }
  }

  private async handleGetHistory(
    sessionId: string,
    command: GetHistoryCommand
  ): Promise<void> {
    const targetSessionId = sessionId || this.state.getCurrentSessionId();

    if (!targetSessionId) {
      return;
    }

    try {
      // Parse optional since parameter
      let sinceDate: Date | undefined;
      if (command.since) {
        sinceDate = new Date(command.since);
        if (isNaN(sinceDate.getTime())) {
          sinceDate = undefined;
        }
      }

      const history = await this.fetchSessionHistory(targetSessionId, sinceDate, command.limit);
      
      const responseData: HistoryResponseData = {
        session_id: targetSessionId,
        session_title: history.title,
        messages: history.messages,
        fetched_at: new Date().toISOString(),
        since: command.since,
        request_id: command.request_id,
        total_count: history.totalCount,
      };

      await this.wsClient.sendHistoryResponse(this.instanceToken, responseData);
    } catch {
      // Silent failure
    }
  }

  private async fetchSessionHistory(
    sessionId: string,
    since?: Date,
    limit?: number
  ): Promise<{ title: string; messages: HistoryMessageData[]; totalCount: number }> {
    // Get session info
    const sessionResult = await this.client.session.get({
      path: { id: sessionId },
    });
    const sessionTitle = sessionResult.data?.title || "Untitled";

    // Get all messages
    const messagesResult = await this.client.session.messages({
      path: { id: sessionId },
    });

    const messages: HistoryMessageData[] = [];
    const allMessages = messagesResult.data || [];
    const totalCount = allMessages.length;
    
    // If limit is specified and no since filter, take only the last N messages
    // We process from the end to get the most recent messages
    const messagesToProcess = limit && !since 
      ? allMessages.slice(-limit) 
      : allMessages;

    for (const msg of messagesToProcess) {
      const info = msg.info;
      const parts = msg.parts || [];

      // Get timestamp from the message - time.created is a Unix timestamp in milliseconds
      const createdMs = info.time?.created;
      const timestamp = createdMs
        ? new Date(createdMs).toISOString()
        : new Date().toISOString();
      const msgDate = new Date(timestamp);

      // Filter by since date if provided
      if (since && msgDate <= since) {
        continue;
      }

      // Convert parts to our structured format
      const historyParts: HistoryPartData[] = [];
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
            tool_args: (part as unknown as Record<string, unknown>).args as
              | Record<string, unknown>
              | undefined,
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

      const historyMsg: HistoryMessageData = {
        id: info.id,
        role: info.role as "user" | "assistant",
        timestamp,
        parts: historyParts,
      };

      // Add assistant-specific metadata
      if (info.role === "assistant") {
        historyMsg.model = info.modelID;
        historyMsg.provider = info.providerID;
        historyMsg.tokens_input = info.tokens?.input
          ? Number(info.tokens.input)
          : undefined;
        historyMsg.tokens_output = info.tokens?.output
          ? Number(info.tokens.output)
          : undefined;
        historyMsg.cost = info.cost ? Number(info.cost) : undefined;
      }

      messages.push(historyMsg);
    }

    return { title: sessionTitle, messages, totalCount };
  }

  private async handlePermissionResponse(
    _sessionId: string,
    command: PermissionCommand
  ): Promise<void> {
    const pendingPermission = this.state.getPendingPermission();

    if (!pendingPermission) {
      notify("Permission Error", "No pending permission");
      return;
    }

    // Validate permission ID matches
    if (
      command.permission_id &&
      command.permission_id !== pendingPermission.id
    ) {
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
          id: pendingPermission.session_id,
          permissionID: pendingPermission.id,
        },
        body: {
          response: command.response,
        },
      });

      // Notify user of successful permission response
      const responseLabel =
        command.response === "once"
          ? "Approved (once)"
          : command.response === "always"
            ? "Approved (always)"
            : "Rejected";
      notify("Permission Response", responseLabel);

      await this.state.clearPermission();
    } catch {
      notify("Permission Error", "Failed to send response");
    }
  }

  private async handleRespondQuestion(
    _sessionId: string,
    command: RespondQuestionCommand
  ): Promise<void> {
    const pendingQuestion = this.state.getPendingQuestion();

    if (!pendingQuestion) {
      notify("Question Error", "No pending question");
      return;
    }

    if (!command.answers || !Array.isArray(command.answers)) {
      notify("Question Error", "Invalid answers format");
      return;
    }

    const requestId = pendingQuestion.request_id;
    
    // Debug logging
    const fs = require("fs");
    fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] Responding to question: requestId=${requestId}, answers=${JSON.stringify(command.answers)}\n`);

    if (!requestId) {
      fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] ERROR: No request_id in pending question\n`);
      notify("Question Error", "No request ID");
      return;
    }

    try {
      const clientAny = this.client as any;
      
      // Check if the client has a question API (v2 SDK)
      if (clientAny.question && typeof clientAny.question.reply === "function") {
        fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] Using client.question.reply()\n`);
        const result = await clientAny.question.reply({
          requestID: requestId,
          answers: command.answers,
        });
        fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] Question reply success via SDK: ${JSON.stringify(result)}\n`);
        notify("Question Response", "Answer submitted");
        return;
      }
      
      // The SDK client has an internal fetch that routes directly to the server
      // We need to use it to call the /question/{id}/reply endpoint
      // Access the internal client which has the configured fetch
      const internalClient = clientAny._client;
      fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] internalClient exists: ${!!internalClient}\n`);
      
      if (internalClient && typeof internalClient.post === "function") {
        fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] Using internal client POST to /question/${requestId}/reply\n`);
        
        const result = await internalClient.post({
          url: `/question/${requestId}/reply`,
          body: { answers: command.answers },
          headers: {
            "Content-Type": "application/json",
          },
        });
        
        fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] Question reply via internal client: ${JSON.stringify(result)}\n`);
        notify("Question Response", "Answer submitted");
        return;
      }
      
      // Fallback: Direct HTTP call to serverUrl (may fail if no HTTP server)
      const url = new URL(`/question/${encodeURIComponent(requestId)}/reply`, this.serverUrl);
      fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] Fallback: Calling POST ${url.toString()}\n`);
      
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answers: command.answers,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] Question API error: ${response.status} ${errorText}\n`);
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] Question reply success: ${JSON.stringify(result)}\n`);
      
      notify("Question Response", "Answer submitted");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      fs.appendFileSync("/tmp/ha-plugin-debug.log", `[${new Date().toISOString()}] Question response error: ${errMsg}\n`);
      notify("Question Error", `Failed: ${errMsg.substring(0, 40)}`);
    }
  }
}
