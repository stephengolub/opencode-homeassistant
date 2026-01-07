# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project Overview

ha-opencode is an OpenCode plugin that integrates with Home Assistant via MQTT Discovery. It exposes OpenCode session state as Home Assistant entities and allows bidirectional control (e.g., responding to permission requests via MQTT commands).

## Build Commands

```bash
npm install        # Install dependencies
npm run build      # Compile TypeScript to dist/
npm run dev        # Watch mode compilation
```

## Installation

```bash
npm install --prefix ~/.config/opencode /path/to/ha-opencode
```

Then add `"ha-opencode"` to the `plugins` array in `~/.config/opencode/opencode.json`.

## Configuration

Supports both environment variables and JSON config in `opencode.json`:

**Environment Variables:**
- `OPENCODE_MQTT_HOST` - broker hostname (default: localhost)
- `OPENCODE_MQTT_PORT` - broker port (default: 1883)
- `OPENCODE_MQTT_USERNAME` / `OPENCODE_MQTT_PASSWORD` - authentication (optional)
- `OPENCODE_HA_DISCOVERY_PREFIX` - Home Assistant discovery prefix (default: homeassistant)

**JSON Config (in opencode.json):**
```json
{
  "ha-opencode": {
    "mqtt": { "host": "...", "port": 1883 },
    "ha": { "discoveryPrefix": "homeassistant" }
  }
}
```

Environment variables take precedence over JSON config.

## Architecture

```
index.ts          Plugin entry point, defers session setup until first event
    ↓
config.ts         Loads MQTT/HA config from environment variables and JSON
mqtt.ts           MQTT client wrapper with pub/sub, wildcard support, and reconnection
discovery.ts      Home Assistant MQTT Discovery - session-based device registration
state.ts          Maps OpenCode events to HA entity state updates
commands.ts       Handles incoming MQTT commands (permissions, prompts, history, cleanup)
cleanup.ts        Removes stale session entities from Home Assistant
notify.ts         Cross-platform terminal notification utilities (Kitty OSC 99)
```

**Data Flow:**
1. Plugin initializes on OpenCode startup, connects to MQTT (without LWT)
2. Background cleanup runs to remove stale sessions (>7 days inactive)
3. On first `session.created` event, plugin extracts session ID
4. `Discovery` is created with session ID → registers device with HA
5. `StateTracker` publishes initial state and subscribes to events
6. When session title becomes valid, `updateDeviceName()` updates HA device friendly name
7. `CommandHandler` subscribes to command topic and processes commands
8. On shutdown (SIGINT/SIGTERM), plugin unregisters device from HA

**Session-Based Identity:**

Each OpenCode session gets its own HA device and entities, identified by session ID:
- Session ID format: `ses_46b09b89bffevq6HeMNIkuvk4B`
- Device ID: `opencode_46b09b89bffevq6HeMNIkuvk4B` (strips `ses_` prefix)
- Initial device name: `OpenCode - {projectName} - Untitled`
- After title available: `OpenCode - {projectName} - {sessionTitle}`

This allows running multiple concurrent OpenCode sessions in the same directory.

**MQTT Topics:**
```
# For session ses_46b09b89bffevq6HeMNIkuvk4B:

# State topics
opencode/opencode_46b09b89bffevq6HeMNIkuvk4B/state
opencode/opencode_46b09b89bffevq6HeMNIkuvk4B/state/attributes
opencode/opencode_46b09b89bffevq6HeMNIkuvk4B/session_title
opencode/opencode_46b09b89bffevq6HeMNIkuvk4B/model
opencode/opencode_46b09b89bffevq6HeMNIkuvk4B/availability

# Commands & responses
opencode/opencode_46b09b89bffevq6HeMNIkuvk4B/command
opencode/opencode_46b09b89bffevq6HeMNIkuvk4B/response

# HA Discovery
homeassistant/sensor/opencode_46b09b89bffevq6HeMNIkuvk4B/state/config

# Global cleanup response
opencode/cleanup/response
```

**Key Types:**
- `EntityKey` - union of all entity keys (state, session_title, model, etc.)
- `PermissionInfo` - permission request details published as attributes
- `MqttWrapper` - interface for MQTT operations (publish, subscribe, unsubscribe, close)
- `TrackedState` - internal state object with all tracked session properties
- `CleanupConfig` - configuration for stale session cleanup

## Key Implementation Details

### Session-Based Device Registration

The plugin creates a unique HA device per OpenCode session:

1. Wait for first `session.created` event to get session ID
2. Create `Discovery` with session ID + project name
3. Register device immediately with initial name: `OpenCode - {project} - Untitled`
4. When valid session title arrives, call `updateDeviceName(title)` to update friendly name
5. Entity `unique_id` stays constant (based on session ID), only display name changes

### Device Name Updates

The device friendly name updates when a valid session title is received:
- Initial: `OpenCode - my-project - Untitled`
- After title: `OpenCode - my-project - Implementing feature X`

Valid title criteria (see `hasValidTitle()` in state.ts):
- Not empty
- Not "No active session"
- Not "Untitled"
- Not "unknown" (case-insensitive)

### State Attributes

The `state` entity publishes these attributes:
- `previous_state` - for automation conditions (published BEFORE state value)
- `agent` - primary agent from user message
- `current_agent` - sub-agent from AgentPart (e.g., "explore", "general")
- `hostname` - machine hostname
- `error_message` - error details when in error state

The `device_id` entity publishes these attributes:
- `command_topic` - topic to send commands
- `response_topic` - topic for command responses
- `state_topic_base` - base path for all state topics
- `device_name` - current device friendly name
- `session_id` - full session ID (e.g., `ses_46b09b89bffevq6HeMNIkuvk4B`)
- `project_name` - project directory name

### Publish Order for Automations

When state changes, attributes are published BEFORE the state value. This ensures that when HA automation triggers on the state MQTT topic, the `previous_state` attribute is already available.

### Stale Session Cleanup

Sessions that haven't been active for 7 days are automatically cleaned up:

**Automatic cleanup:**
- Runs on every plugin startup (async, non-blocking)
- Subscribes to `opencode/+/last_activity` to discover all sessions
- Removes sessions where `last_activity` is older than 7 days
- Publishes empty configs to remove entities from HA

**Manual cleanup via MQTT command:**
```json
{
  "command": "cleanup_stale_sessions",
  "max_age_days": 7
}
```

Response published to `opencode/cleanup/response`:
```json
{
  "type": "cleanup_result",
  "sessions_removed": 3,
  "session_ids": ["opencode_abc123...", "opencode_def456..."],
  "max_age_days": 7,
  "timestamp": "2025-01-07T12:00:00Z"
}
```

### Graceful Shutdown

Plugin registers handlers for SIGINT and SIGTERM to:
1. Publish "offline" to availability topic
2. Unregister device from Home Assistant (publishes empty configs)
3. Close MQTT connection

### Availability Tracking

Entities are automatically marked as unavailable when the plugin disconnects:
- Availability topic: `opencode/{deviceId}/availability`
- Payloads: "online" when connected, "offline" when disconnected

Note: LWT (Last Will and Testament) is not configured until a session is established, so crash detection only works after the first session event.

## Testing

Unit tests are available using Vitest:

```bash
npm test              # Run tests once
npm run test:watch    # Run in watch mode
npm run test:coverage # Run with coverage report
```

## HA Card Component

The `ha-card/` directory contains a custom Lovelace card for Home Assistant.

```
ha-card/
  src/opencode-card.ts    Single-file card implementation
  dist/opencode-card.js   Built card for deployment
  package.json            Card build dependencies
  README.md               Card installation and automation examples
```

Build the card:
```bash
cd ha-card
npm install
npm run build
```

## Testing Changes

1. Build: `npm run build`
2. Install: `npm install --prefix ~/.config/opencode /path/to/ha-opencode`
3. Restart OpenCode
4. Check MQTT messages: use MQTT Explorer or `mosquitto_sub -t "opencode/#" -v`
5. Check HA entities: Developer Tools > States > filter "opencode"

## Common Issues

### Too many entities in HA
- Each session creates a new set of entities
- Use the cleanup command or automatic cleanup to remove old sessions
- Sessions inactive for 7+ days are automatically removed on plugin startup

### Automation not triggering
- Check that `previous_state` attribute is available when state changes
- Attributes are published BEFORE state value
- Use the robust entity lookup pattern (by `state_topic_base` attribute)

### Entity naming shows "Untitled"
- This is the initial name before session title is available
- Once the session gets a proper title, the device name updates automatically
- The entity `unique_id` remains constant (based on session ID)

### Kitty notifications not working
- Ensure terminal supports OSC 99 (Kitty, iTerm2)
- Check that stdout is a TTY


