import { hostname } from "os";
import type { Event, Permission } from "@opencode-ai/sdk";
import type { Discovery, EntityKey, PermissionInfo } from "./discovery.js";

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
  private readonly discovery: Discovery;
  private state: TrackedState;
  private pendingPermission: PermissionInfo | null = null;
  private currentSessionId: string | null = null;
  private deviceNameUpdated = false;

  constructor(discovery: Discovery) {
    this.discovery = discovery;
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

  /**
   * Check if we have a valid session title for updating the device friendly name.
   */
  private hasValidTitle(): boolean {
    const title = this.state.sessionTitle;
    return !!(
      title &&
      title !== "No active session" &&
      title !== "Untitled" &&
      title.toLowerCase() !== "unknown"
    );
  }

  /**
   * Initialize the state tracker.
   * Registers the device with Home Assistant immediately since we have the session ID.
   */
  async initialize(): Promise<void> {
    await this.discovery.registerDevice();
    await this.discovery.publishDeviceInfo();
    await this.discovery.publishAvailable();
    await this.publishAll();
    await this.publishStateAttributes();
    await this.discovery.publishPermission(null);
  }

  getPendingPermission(): PermissionInfo | null {
    return this.pendingPermission;
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
      console.error(
        `[ha-opencode] Error in handleEvent for '${event.type}':`,
        err
      );
      console.error(
        `[ha-opencode] Event properties:`,
        JSON.stringify(event.properties, null, 2)
      );
      throw err;
    }
  }

  private async onSessionCreated(
    event: Extract<Event, { type: "session.created" }>
  ): Promise<void> {
    this.currentSessionId = event.properties.info.id;
    this.state.sessionTitle = event.properties.info.title || "Untitled";
    this.state.tokensInput = 0;
    this.state.tokensOutput = 0;
    this.state.cost = 0;
    this.updateActivity();

    // Check if we got a valid title on creation
    await this.maybeUpdateDeviceName();

    await this.publish("session_title", this.state.sessionTitle);
    await this.updateState("idle");
    await this.publish("tokens_input", this.state.tokensInput);
    await this.publish("tokens_output", this.state.tokensOutput);
    await this.publish("cost", this.state.cost);
    await this.publish("last_activity", this.state.lastActivity);
  }

  private async onSessionUpdated(
    event: Extract<Event, { type: "session.updated" }>
  ): Promise<void> {
    const title = event.properties.info.title;
    const titleChanged = title && title !== this.state.sessionTitle;

    if (titleChanged) {
      this.state.sessionTitle = title;
    }
    this.updateActivity();

    // Update device friendly name when we get a valid title
    await this.maybeUpdateDeviceName();

    if (titleChanged) {
      await this.publish("session_title", this.state.sessionTitle);
    }
    await this.publish("last_activity", this.state.lastActivity);
  }

  /**
   * Update the device friendly name in Home Assistant if we have a valid title
   * and haven't done so yet.
   */
  private async maybeUpdateDeviceName(): Promise<void> {
    if (!this.deviceNameUpdated && this.hasValidTitle()) {
      await this.discovery.updateDeviceName(this.state.sessionTitle);
      // Also update device_id attributes with new device name
      await this.discovery.publishDeviceInfo();
      this.deviceNameUpdated = true;
    }
  }

  private async onSessionIdle(
    _event: Extract<Event, { type: "session.idle" }>
  ): Promise<void> {
    this.state.currentTool = "none";
    this.updateActivity();

    await this.updateState("idle");
    await this.publish("current_tool", this.state.currentTool);
    await this.publish("last_activity", this.state.lastActivity);
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
    await this.publish("last_activity", this.state.lastActivity);
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
        await this.publishStateAttributes();
      }
    } else if (message.role === "assistant") {
      // Update model info
      this.state.model = `${message.providerID}/${message.modelID}`;
      await this.publish("model", this.state.model);

      // Update token counts and cost
      // Note: SDK may return Decimal objects, so convert to primitives
      this.state.tokensInput = Number(message.tokens.input);
      this.state.tokensOutput = Number(message.tokens.output);
      this.state.cost = Number(message.cost);

      await this.publish("tokens_input", this.state.tokensInput);
      await this.publish("tokens_output", this.state.tokensOutput);
      await this.publish("cost", this.state.cost);
    }

    this.updateActivity();
    await this.publish("last_activity", this.state.lastActivity);
  }

  private async onMessagePartUpdated(
    event: Extract<Event, { type: "message.part.updated" }>
  ): Promise<void> {
    const part = event.properties.part;

    // When receiving text parts with deltas, the model is actively working
    if (part.type === "text" && event.properties.delta) {
      await this.updateState("working");
    }

    // Track agent/sub-agent switching
    if (part.type === "agent") {
      if (part.name !== this.state.currentAgent) {
        this.state.currentAgent = part.name;
        await this.publishStateAttributes();
      }
    }

    // Track tool execution
    if (part.type === "tool") {
      const toolState = part.state;

      if (toolState.status === "running") {
        this.state.currentTool = part.tool;
        await this.updateState("working");
        await this.publish("current_tool", this.state.currentTool);
      } else if (toolState.status === "completed" || toolState.status === "error") {
        this.state.currentTool = "none";
        await this.publish("current_tool", this.state.currentTool);
      }
    }

    this.updateActivity();
    await this.publish("last_activity", this.state.lastActivity);
  }

  private async onPermissionUpdated(
    event: Extract<Event, { type: "permission.updated" }>
  ): Promise<void> {
    const permission = event.properties as Permission;

    this.pendingPermission = {
      id: permission.id,
      type: permission.type,
      title: permission.title,
      sessionID: permission.sessionID,
      messageID: permission.messageID,
      callID: permission.callID,
      pattern: permission.pattern,
      metadata: permission.metadata,
    };

    this.updateActivity();

    await this.updateState("waiting_permission");
    await this.publish("last_activity", this.state.lastActivity);
    await this.discovery.publishPermission(this.pendingPermission);
  }

  private async onPermissionReplied(
    _event: Extract<Event, { type: "permission.replied" }>
  ): Promise<void> {
    this.pendingPermission = null;
    this.updateActivity();

    await this.updateState("working");
    await this.publish("last_activity", this.state.lastActivity);
    await this.discovery.publishPermission(null);
  }

  async clearPermission(): Promise<void> {
    this.pendingPermission = null;
    await this.discovery.publishPermission(null);
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

      // IMPORTANT: Publish attributes BEFORE state so that when HA automation
      // triggers on state topic, the previous_state attribute is already available
      await this.publishStateAttributes();
      await this.publish("state", this.state.state);
    }
  }

  private async publishStateAttributes(): Promise<void> {
    await this.discovery.publishAttributes("state", {
      previous_state: this.state.previousState,
      agent: this.state.agent,
      current_agent: this.state.currentAgent,
      hostname: hostname(),
      error_message: this.state.errorMessage,
    });
  }

  private async publish(
    key: EntityKey,
    value: string | number
  ): Promise<void> {
    try {
      await this.discovery.publishState(key, value);
    } catch (err) {
      console.error(`[ha-opencode] Failed to publish ${key}:`, err);
    }
  }

  private async publishAll(): Promise<void> {
    await this.publish("state", this.state.state);
    await this.publish("session_title", this.state.sessionTitle);
    await this.publish("model", this.state.model);
    await this.publish("current_tool", this.state.currentTool);
    await this.publish("tokens_input", this.state.tokensInput);
    await this.publish("tokens_output", this.state.tokensOutput);
    await this.publish("cost", this.state.cost);
    await this.publish("last_activity", this.state.lastActivity);
  }
}
