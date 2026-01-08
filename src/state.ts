import { hostname } from "os";
import type { Event, Permission } from "@opencode-ai/sdk";
import type { HAWebSocketClient, SessionUpdate, PermissionInfo } from "./websocket.js";

type SessionState = "idle" | "working" | "waiting_permission" | "error";

interface TrackedState {
  state: SessionState;
  previousState: SessionState | null;
  sessionTitle: string;
  model: string;
  currentTool: string;
  tokensInput: number;
  tokensOutput: number;
  cost: number;
  lastActivity: string;
  agent: string | null;
  currentAgent: string | null;
  errorMessage: string | null;
}

export class StateTracker {
  private readonly wsClient: HAWebSocketClient;
  private readonly instanceToken: string;
  private state: TrackedState;
  private pendingPermission: PermissionInfo | null = null;
  private currentSessionId: string | null = null;
  private projectName: string;

  constructor(
    wsClient: HAWebSocketClient,
    instanceToken: string,
    projectName: string
  ) {
    this.wsClient = wsClient;
    this.instanceToken = instanceToken;
    this.projectName = projectName;
    this.state = {
      state: "idle",
      previousState: null,
      sessionTitle: "Untitled",
      model: "unknown",
      currentTool: "none",
      tokensInput: 0,
      tokensOutput: 0,
      cost: 0,
      lastActivity: new Date().toISOString(),
      agent: null,
      currentAgent: null,
      errorMessage: null,
    };
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  getPendingPermission(): PermissionInfo | null {
    return this.pendingPermission;
  }

  /**
   * Set the current session ID and optionally publish an update.
   * Used when initializing with an existing session.
   */
  async setSessionId(sessionId: string, publishUpdate: boolean = false): Promise<void> {
    this.currentSessionId = sessionId;
    if (publishUpdate) {
      await this.publishUpdate();
    }
  }

  /**
   * Build a session update object for sending to HA.
   */
  private buildSessionUpdate(): SessionUpdate {
    return {
      session_id: this.currentSessionId || "",
      title: this.state.sessionTitle,
      state: this.state.state,
      previous_state: this.state.previousState,
      model: this.state.model,
      current_tool: this.state.currentTool,
      tokens_input: this.state.tokensInput,
      tokens_output: this.state.tokensOutput,
      cost: this.state.cost,
      last_activity: this.state.lastActivity,
      agent: this.state.agent,
      current_agent: this.state.currentAgent,
      hostname: hostname(),
      error_message: this.state.errorMessage,
      permission: this.pendingPermission,
    };
  }

  /**
   * Send the current session state to Home Assistant.
   */
  private async publishUpdate(): Promise<void> {
    if (!this.currentSessionId) {
      return;
    }

    try {
      await this.wsClient.sendSessionUpdate(
        this.instanceToken,
        this.buildSessionUpdate()
      );
    } catch {
      // Silent failure
    }
  }

  /**
   * Get all current sessions for state response.
   * Currently we only track one session at a time.
   */
  getAllSessions(): SessionUpdate[] {
    if (!this.currentSessionId) {
      return [];
    }
    return [this.buildSessionUpdate()];
  }

  async handleEvent(event: Event): Promise<void> {
    try {
      switch (event.type) {
        case "session.created":
          await this.onSessionCreated(event);
          break;
        case "session.updated":
          await this.onSessionUpdated(event);
          break;
        case "session.idle":
          await this.onSessionIdle(event);
          break;
        case "session.error":
          await this.onSessionError(event);
          break;
        case "message.updated":
          await this.onMessageUpdated(event);
          break;
        case "message.part.updated":
          await this.onMessagePartUpdated(event);
          break;
        case "permission.updated":
          await this.onPermissionUpdated(event);
          break;
        case "permission.replied":
          await this.onPermissionReplied(event);
          break;
      }
    } catch (err) {
      throw err;
    }
  }

  private async onSessionCreated(
    event: Extract<Event, { type: "session.created" }>
  ): Promise<void> {
    const newSessionId = event.properties.info.id;
    
    // If switching sessions, notify HA to remove the old one
    if (this.currentSessionId && this.currentSessionId !== newSessionId) {
      try {
        await this.wsClient.sendSessionRemoved(this.instanceToken, this.currentSessionId);
      } catch {
        // Silent failure
      }
    }
    
    this.currentSessionId = newSessionId;
    this.state.sessionTitle = event.properties.info.title || "Untitled";
    this.state.tokensInput = 0;
    this.state.tokensOutput = 0;
    this.state.cost = 0;
    this.state.state = "idle";
    this.state.previousState = null;
    this.updateActivity();

    await this.publishUpdate();
  }

  private async onSessionUpdated(
    event: Extract<Event, { type: "session.updated" }>
  ): Promise<void> {
    const title = event.properties.info.title;
    if (title && title !== this.state.sessionTitle) {
      this.state.sessionTitle = title;
    }
    this.updateActivity();

    await this.publishUpdate();
  }

  private async onSessionIdle(
    _event: Extract<Event, { type: "session.idle" }>
  ): Promise<void> {
    this.state.currentTool = "none";
    this.updateActivity();

    await this.updateState("idle");
  }

  private async onSessionError(
    event: Extract<Event, { type: "session.error" }>
  ): Promise<void> {
    this.updateActivity();

    // Capture error message if available
    const error = event.properties.error;
    if (error && typeof error === "object" && "message" in error) {
      this.state.errorMessage = String(error.message);
    } else if (error && typeof error === "object" && "name" in error) {
      this.state.errorMessage = String(error.name);
    } else {
      this.state.errorMessage = "Unknown error";
    }

    await this.updateState("error");
  }

  private async onMessageUpdated(
    event: Extract<Event, { type: "message.updated" }>
  ): Promise<void> {
    const message = event.properties.info;

    if (message.role === "user") {
      // Track primary agent from user message
      if (message.agent && message.agent !== this.state.agent) {
        this.state.agent = message.agent;
        // Reset current agent when new user message arrives
        this.state.currentAgent = null;
      }
    } else if (message.role === "assistant") {
      // Update model info
      this.state.model = `${message.providerID}/${message.modelID}`;

      // Update token counts and cost
      // Note: SDK may return Decimal objects, so convert to primitives
      this.state.tokensInput = Number(message.tokens.input);
      this.state.tokensOutput = Number(message.tokens.output);
      this.state.cost = Number(message.cost);
    }

    this.updateActivity();
    await this.publishUpdate();
  }

  private async onMessagePartUpdated(
    event: Extract<Event, { type: "message.part.updated" }>
  ): Promise<void> {
    const part = event.properties.part;
    let stateChanged = false;

    // When receiving text parts with deltas, the model is actively working
    if (part.type === "text" && event.properties.delta) {
      if (this.state.state !== "working") {
        await this.updateState("working");
        stateChanged = true;
      }
    }

    // Track agent/sub-agent switching
    if (part.type === "agent") {
      if (part.name !== this.state.currentAgent) {
        this.state.currentAgent = part.name;
      }
    }

    // Track tool execution
    if (part.type === "tool") {
      const toolState = part.state;

      if (toolState.status === "running") {
        this.state.currentTool = part.tool;
        if (this.state.state !== "working") {
          await this.updateState("working");
          stateChanged = true;
        }
      } else if (toolState.status === "completed" || toolState.status === "error") {
        this.state.currentTool = "none";
      }
    }

    this.updateActivity();
    
    // Only publish if state didn't change (updateState already publishes)
    if (!stateChanged) {
      await this.publishUpdate();
    }
  }

  private async onPermissionUpdated(
    event: Extract<Event, { type: "permission.updated" }>
  ): Promise<void> {
    const permission = event.properties as Permission;

    // Pattern might be string | string[] from SDK, convert to string
    const pattern = Array.isArray(permission.pattern) 
      ? permission.pattern.join(", ") 
      : permission.pattern;
      
    this.pendingPermission = {
      id: permission.id,
      type: permission.type,
      title: permission.title,
      session_id: permission.sessionID,
      message_id: permission.messageID,
      call_id: permission.callID,
      pattern,
      metadata: permission.metadata,
    };

    this.updateActivity();

    await this.updateState("waiting_permission");
  }

  private async onPermissionReplied(
    _event: Extract<Event, { type: "permission.replied" }>
  ): Promise<void> {
    this.pendingPermission = null;
    this.updateActivity();

    await this.updateState("working");
  }

  async clearPermission(): Promise<void> {
    this.pendingPermission = null;
    await this.publishUpdate();
  }

  private updateActivity(): void {
    this.state.lastActivity = new Date().toISOString();
  }

  private async updateState(newState: SessionState): Promise<void> {
    if (this.state.state !== newState) {
      this.state.previousState = this.state.state;
      this.state.state = newState;

      // Clear error message when transitioning away from error state
      if (newState !== "error") {
        this.state.errorMessage = null;
      }

      await this.publishUpdate();
    }
  }
}
