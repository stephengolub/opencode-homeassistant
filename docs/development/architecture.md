# Architecture

This document describes the internal architecture of the OpenCode Home Assistant Plugin.

## Overview

The plugin acts as a bridge between OpenCode and Home Assistant, using MQTT as the communication layer.

```
┌────────────────────────────────────────────────────────────────────┐
│                        OpenCode Process                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    ha-opencode Plugin                         │  │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌───────────────┐  │  │
│  │  │  State  │  │ Commands │  │  MQTT   │  │   Discovery   │  │  │
│  │  │ Tracker │  │ Handler  │  │ Client  │  │    Manager    │  │  │
│  │  └────┬────┘  └────┬─────┘  └────┬────┘  └───────┬───────┘  │  │
│  │       │            │             │               │           │  │
│  └───────┼────────────┼─────────────┼───────────────┼───────────┘  │
│          │            │             │               │               │
└──────────┼────────────┼─────────────┼───────────────┼───────────────┘
           │            │             │               │
           │            │             ▼               │
           │            │      ┌─────────────┐        │
           │            │      │    MQTT     │        │
           │            │      │   Broker    │        │
           │            │      └──────┬──────┘        │
           │            │             │               │
           │            │             ▼               │
           │            │      ┌─────────────────┐    │
           │            └─────►│  Home Assistant │◄───┘
           └──────────────────►│    + MQTT       │
                               │   Integration   │
                               └─────────────────┘
```

## Core Components

### Entry Point (`index.ts`)

The main plugin entry point that:

- Implements the OpenCode plugin interface
- Initializes all components
- Handles plugin lifecycle (start/stop)
- Subscribes to OpenCode events

### State Tracker (`state.ts`)

Manages session state and publishes updates to Home Assistant.

**Responsibilities**:

- Track current session ID and state
- Monitor permission requests
- Debounce rapid state changes
- Publish state updates via MQTT

**State Machine**:

```
       ┌─────────────────────────────────────┐
       │                                     │
       ▼                                     │
   ┌───────┐   task started   ┌─────────┐   │
   │ idle  │─────────────────►│ working │───┤
   └───────┘                  └────┬────┘   │
       ▲                           │        │
       │                           ▼        │
       │                    ┌─────────────┐ │
       │    approved/       │  waiting_   │ │
       │    rejected        │ permission  │ │
       │◄───────────────────└─────────────┘ │
       │                                     │
       │         task complete               │
       └─────────────────────────────────────┘
```

### MQTT Client (`mqtt.ts`)

Wraps the MQTT.js client with:

- Connection management
- Automatic reconnection
- Message publishing helpers
- Subscription management
- Graceful shutdown

### Discovery Manager (`discovery.ts`)

Handles Home Assistant MQTT Discovery:

- Generates discovery payloads for all entities
- Publishes device configuration
- Manages entity availability
- Supports cleanup of stale devices

**Entity Types Created**:

| Entity | Discovery Type | Purpose |
|--------|---------------|---------|
| state | sensor | Session state |
| session_title | sensor | Session name |
| model | sensor | AI model |
| current_tool | sensor | Active tool |
| cost | sensor | Session cost |
| tokens_input | sensor | Input tokens |
| tokens_output | sensor | Output tokens |
| last_activity | sensor | Timestamp |
| permission | sensor | Permission state |
| device_id | sensor | Device info + topics |

### Command Handler (`commands.ts`)

Processes commands received via MQTT:

- Permission responses
- Prompt submission
- History retrieval
- Agent listing
- Session cleanup

**Command Flow**:

```
MQTT Message
     │
     ▼
┌─────────────┐
│   Parse     │
│    JSON     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Validate   │
│   Command   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Execute    │
│   Action    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Publish    │
│  Response   │
└─────────────┘
```

### Configuration (`config.ts`)

Loads and validates configuration from:

1. Environment variables
2. Global OpenCode config
3. Project-specific config
4. Default values

### Notifications (`notify.ts`)

Sends local terminal notifications using OSC escape sequences (Kitty terminal protocol).

### Cleanup (`cleanup.ts`)

Handles removal of stale MQTT topics when sessions end or devices are removed.

## Event Flow

### Session Start

1. OpenCode emits `session.start` event
2. Plugin captures session ID
3. State tracker updates to `working`
4. Discovery publishes device config
5. State published to MQTT

### Permission Request

1. OpenCode emits `permission.request` event
2. State tracker stores permission details
3. State changes to `waiting_permission`
4. Permission entity updated with details
5. Home Assistant receives notification trigger

### Permission Response

1. User taps Approve/Reject in HA
2. MQTT message sent to command topic
3. Command handler validates request
4. Response sent to OpenCode SDK
5. State returns to `working` or `idle`

### Message Processing

1. OpenCode emits `message.updated` event
2. Plugin extracts tool info, tokens, cost
3. Relevant sensors updated via MQTT
4. If tool pending, `current_tool` updated

## Error Handling

- MQTT connection failures: Automatic reconnect with backoff
- Invalid commands: Logged and ignored
- SDK errors: Logged, state set to `error`
- Configuration errors: Fail fast with clear message

## Testing Strategy

- Unit tests for each component
- Mock MQTT client for integration tests
- Mock OpenCode SDK responses
- Coverage targets: >80%
