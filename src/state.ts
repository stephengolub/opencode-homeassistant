import { hostname } from "os";
import type { Event, Permission } from "@opencode-ai/sdk";
import type { HAWebSocketClient, SessionUpdate, PermissionInfo, QuestionInfo, QuestionItem } from "./websocket.js";

type SessionState = "idle" | "working" | "waiting_permission" | "waiting_input" | "error";

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
  parentSessionId: string | null;
  pendingQuestion: QuestionInfo | null;
}

export class StateTracker {
  private readonly wsClient: HAWebSocketClient;
  private readonly instanceToken: string;
  private state: TrackedState;
  private pendingPermission: PermissionInfo | null = null;
  private currentSessionId: string | null = null;
  private projectName: string;
  
  // Callback when question tool starts running (caller should start polling)
  public onQuestionToolStarted: (() => void) | null = null;

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
      parentSessionId: null,
      pendingQuestion: null,
    };
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  getPendingPermission(): PermissionInfo | null {
    return this.pendingPermission;
  }

  getPendingQuestion(): QuestionInfo | null {
    return this.state.pendingQuestion;
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
      parent_session_id: this.state.parentSessionId,
      question: this.state.pendingQuestion,
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
      const update = this.buildSessionUpdate();
      await this.wsClient.sendSessionUpdate(
        this.instanceToken,
        update
      );
    } catch {
      // Silent failure - HA may be temporarily unavailable
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
      // Cast to string for switch since v1 SDK doesn't include question events
      const eventType = event.type as string;
      
      switch (eventType) {
        case "session.created":
          await this.onSessionCreated(event as Extract<Event, { type: "session.created" }>);
          break;
        case "session.updated":
          await this.onSessionUpdated(event as Extract<Event, { type: "session.updated" }>);
          break;
        case "session.idle":
          await this.onSessionIdle(event as Extract<Event, { type: "session.idle" }>);
          break;
        case "session.error":
          await this.onSessionError(event as Extract<Event, { type: "session.error" }>);
          break;
        case "message.updated":
          await this.onMessageUpdated(event as Extract<Event, { type: "message.updated" }>);
          break;
        case "message.part.updated":
          await this.onMessagePartUpdated(event as Extract<Event, { type: "message.part.updated" }>);
          break;
        case "permission.updated":
        case "permission.asked":
          // Handle both v1 (permission.updated) and v2 (permission.asked) event names
          await this.onPermissionUpdated(event as Extract<Event, { type: "permission.updated" }>);
          break;
        case "permission.replied":
          await this.onPermissionReplied(event as Extract<Event, { type: "permission.replied" }>);
          break;
        case "question.asked":
          // Handle question.asked events (not typed in v1 SDK but still received)
          await this.onQuestionAsked(event as any);
          break;
        case "question.replied":
        case "question.rejected":
          // Question was answered/rejected - clear the pending question
          await this.onQuestionResolved(event as any);
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
    const sessionInfo = event.properties.info;
    
    // If switching sessions, notify HA to remove the old one
    if (this.currentSessionId && this.currentSessionId !== newSessionId) {
      try {
        await this.wsClient.sendSessionRemoved(this.instanceToken, this.currentSessionId);
      } catch {
        // Silent failure
      }
    }
    
    this.currentSessionId = newSessionId;
    this.state.sessionTitle = sessionInfo.title || "Untitled";
    this.state.tokensInput = 0;
    this.state.tokensOutput = 0;
    this.state.cost = 0;
    this.state.state = "idle";
    this.state.previousState = null;
    // Track parent session ID for sub-agent sessions
    this.state.parentSessionId = (sessionInfo as { parentID?: string }).parentID || null;
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
    // BUT don't override waiting_permission state - that takes priority
    if (part.type === "text" && event.properties.delta) {
      if (this.state.state !== "working" && this.state.state !== "waiting_permission") {
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
        // Don't override waiting_permission or waiting_input state - those take priority
        if (this.state.state !== "working" && this.state.state !== "waiting_permission" && this.state.state !== "waiting_input") {
          await this.updateState("working");
          stateChanged = true;
        }
        
        // Notify if question tool started (caller should start polling)
        // Note: The tool name might vary - check for common patterns
        const toolName = part.tool?.toLowerCase() || "";
        const isQuestionTool = toolName === "question" || toolName.includes("question");
        
        if (isQuestionTool) {
          // Note: We don't set question here because we don't have the
          // proper question request_id. The question.asked event will fire
          // with the correct ID (qst_xxx format) that we need for reply API.
        }
      } else if (toolState.status === "completed" || toolState.status === "error") {
        this.state.currentTool = "none";
        
        // Clear question if question tool completed/errored
        if (part.tool === "question" && this.state.pendingQuestion) {
          this.state.pendingQuestion = null;
          if (this.state.state === "waiting_input") {
            await this.updateState("working");
            stateChanged = true;
          }
        }
      }
    }

    this.updateActivity();
    
    // Only publish if state didn't change (updateState already publishes)
    if (!stateChanged) {
      await this.publishUpdate();
    }
  }

  private async onPermissionUpdated(
    event: Extract<Event, { type: "permission.updated" }> | { type: "permission.asked"; properties: any }
  ): Promise<void> {
    const props = event.properties;
    
    // Detect v1 vs v2 format based on properties
    // v1: has 'type', 'title', 'pattern', top-level messageID/callID
    // v2: has 'permission', 'patterns' (array), nested tool.messageID/callID
    const isV2 = "permission" in props && "patterns" in props;
    
    let permissionId: string;
    let permissionType: string;
    let permissionTitle: string;
    let sessionId: string;
    let messageId: string | undefined;
    let callId: string | undefined;
    let pattern: string | undefined;
    let metadata: Record<string, unknown>;
    
    if (isV2) {
      // v2 format (permission.asked)
      permissionId = props.id;
      permissionType = props.permission; // "bash", "edit", etc.
      permissionTitle = props.permission; // v2 doesn't have title, use permission type
      sessionId = props.sessionID;
      messageId = props.tool?.messageID;
      callId = props.tool?.callID;
      pattern = Array.isArray(props.patterns) ? props.patterns.join(", ") : undefined;
      metadata = props.metadata || {};
    } else {
      // v1 format (permission.updated)
      const permission = props as Permission;
      permissionId = permission.id;
      permissionType = permission.type;
      permissionTitle = permission.title;
      sessionId = permission.sessionID;
      messageId = permission.messageID;
      callId = permission.callID;
      pattern = Array.isArray(permission.pattern) 
        ? permission.pattern.join(", ") 
        : permission.pattern;
      metadata = permission.metadata;
    }
      
    this.pendingPermission = {
      id: permissionId,
      type: permissionType,
      title: permissionTitle,
      session_id: sessionId,
      message_id: messageId,
      call_id: callId,
      pattern,
      metadata,
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

  /**
   * Handle question.asked event from OpenCode server.
   * This captures the proper question request ID needed for replying.
   */
  private async onQuestionAsked(
    event: { type: "question.asked"; properties: { id: string; sessionID: string; questions: any[]; tool?: { messageID: string; callID: string } } }
  ): Promise<void> {
    const props = event.properties;
    
    // Extract question data from the event
    const questions: QuestionItem[] = (props.questions || []).map((q: any) => ({
      question: q.question || "",
      header: q.header || "",
      multiple: q.multiple || false,
      options: (q.options || []).map((opt: any) => ({
        label: opt.label || "",
        description: opt.description || "",
      })),
    }));
    
    const questionInfo: QuestionInfo = {
      session_id: props.sessionID,
      request_id: props.id, // This is the REAL question request ID (qst_xxx)
      questions,
    };
    
    await this.setQuestion(questionInfo);
  }

  /**
   * Handle question.replied or question.rejected events.
   * Clears the pending question state.
   */
  private async onQuestionResolved(
    event: { type: "question.replied" | "question.rejected"; properties: { sessionID: string; requestID: string } }
  ): Promise<void> {
    // Only clear if it matches the pending question
    if (this.state.pendingQuestion?.request_id === event.properties.requestID) {
      await this.clearQuestion();
    }
  }

  async clearPermission(): Promise<void> {
    this.pendingPermission = null;
    await this.publishUpdate();
  }

  /**
   * Set a pending question and transition to waiting_input state.
   */
  async setQuestion(question: QuestionInfo): Promise<void> {
    this.state.pendingQuestion = question;
    this.updateActivity();
    await this.updateState("waiting_input");
  }

  /**
   * Clear the pending question and transition back to working state.
   */
  async clearQuestion(): Promise<void> {
    this.state.pendingQuestion = null;
    this.updateActivity();
    await this.updateState("working");
  }

  /**
   * Check if currently waiting for input (question).
   */
  isWaitingForInput(): boolean {
    return this.state.state === "waiting_input";
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
