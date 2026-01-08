# Architecture

This document describes the internal architecture of the OpenCode Home Assistant Plugin.

## Overview

The plugin acts as a bridge between OpenCode and Home Assistant, using native WebSocket communication.

```
┌────────────────────────────────────────────────────────────────────┐
│                        OpenCode Process                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    ha-opencode Plugin                         │  │
│  │  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌─────────────┐   │  │
│  │  │  State  │  │ Commands │  │ WebSocket │  │   Config    │   │  │
│  │  │ Tracker │  │ Handler  │  │  Client   │  │   Store     │   │  │
│  │  └────┬────┘  └────┬─────┘  └─────┬─────┘  └──────┬──────┘   │  │
│  │       │            │              │               │           │  │
│  └───────┼────────────┼──────────────┼───────────────┼───────────┘  │
│          │            │              │               │               │
└──────────┼────────────┼──────────────┼───────────────┼───────────────┘
           │            │              │               │
           │            │              ▼               │
           │            │      ┌─────────────────┐     │
           │            └─────►│  Home Assistant │◄────┘
           └──────────────────►│   WebSocket API │
                               └─────────────────┘
```

## Core Components

### Entry Point (`index.ts`)

The main plugin entry point that:

- Implements the OpenCode plugin interface
- Initializes all components
- Handles plugin lifecycle (start/stop)
- Subscribes to OpenCode events
- Manages pairing flow

### WebSocket Client (`websocket.ts`)

Handles communication with Home Assistant:

- Connects to HA WebSocket API
- Authenticates with access token
- Sends session updates
- Receives commands from HA
- Handles reconnection

**Message Types**:

| Type | Direction | Purpose |
|------|-----------|---------|
| `opencode/pair` | Plugin → HA | Initial pairing |
| `opencode/connect` | Plugin → HA | Reconnect with token |
| `opencode/session_update` | Plugin → HA | Session state update |
| `opencode/command` | HA → Plugin | Commands (prompt, permission, etc.) |
| `opencode/history_response` | Plugin → HA | Session history |
| `opencode/agents_response` | Plugin → HA | Available agents |

### State Tracker (`state.ts`)

Manages session state and pushes updates to Home Assistant.

**Responsibilities**:

- Track current session ID and state
- Monitor permission requests
- Aggregate session data (tokens, cost, etc.)
- Send updates via WebSocket

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

### Command Handler (`commands.ts`)

Processes commands received from Home Assistant:

- `send_prompt` - Send prompt to OpenCode
- `respond_permission` - Approve/reject permissions
- `get_history` - Retrieve session history
- `get_agents` - List available agents

**Command Flow**:

```
WebSocket Message
     │
     ▼
┌─────────────┐
│   Parse     │
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
│  Send       │
│  Response   │
└─────────────┘
```

### Configuration (`ha-config.ts`)

Manages persistent configuration:

- Stores connection details after pairing
- Loads saved configuration on startup
- Supports environment variable overrides

### Notifications (`notify.ts`)

Sends local terminal notifications using OSC escape sequences (Kitty terminal protocol).

## Event Flow

### Pairing Flow

1. User adds OpenCode integration in HA
2. HA generates pairing code
3. User invokes `ha_pair` in OpenCode
4. Plugin connects to HA WebSocket
5. Plugin sends `opencode/pair` with code
6. HA validates code, returns instance token
7. Plugin stores token for future connections

### Session Start

1. OpenCode emits `session.created` event
2. Plugin captures session ID
3. State tracker initializes session data
4. Session update sent to HA via WebSocket
5. HA creates entities for the session

### Permission Request

1. OpenCode emits `permission.requested` event
2. State tracker stores permission details
3. State changes to `waiting_permission`
4. Session update sent to HA
5. HA fires `opencode_permission_request` event
6. Automations/card show permission details

### Permission Response

1. User approves/rejects in HA (card, notification, or automation)
2. HA sends `opencode/command` via WebSocket
3. Command handler receives `respond_permission`
4. Response sent to OpenCode SDK
5. State returns to `working` or `idle`

### Message Processing

1. OpenCode emits `message.updated` event
2. Plugin extracts tool info, tokens, cost
3. Session update sent to HA
4. HA entities update automatically

## Reconnection

The plugin handles disconnections gracefully:

1. WebSocket closes unexpectedly
2. Reconnection timer starts (5 second delay)
3. Plugin reconnects using saved instance token
4. HA recognizes returning instance
5. State synchronization occurs
6. Normal operation resumes

## Error Handling

- WebSocket failures: Automatic reconnect with backoff
- Invalid commands: Logged via notification
- SDK errors: Logged, state set to `error`
- Authentication errors: Clear config, require re-pairing

## Testing Strategy

- Unit tests for each component
- Mock WebSocket client for integration tests
- Mock OpenCode SDK responses
- All 43 tests passing
