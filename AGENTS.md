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
- `MQTT_HOST` - broker hostname (default: localhost)
- `MQTT_PORT` - broker port (default: 1883)
- `MQTT_USERNAME` / `MQTT_PASSWORD` - authentication (optional)
- `HA_DISCOVERY_PREFIX` - Home Assistant discovery prefix (default: homeassistant)

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
index.ts          Plugin entry point, wires up all components, handles shutdown
    ↓
config.ts         Loads MQTT/HA config from environment variables and JSON
mqtt.ts           MQTT client wrapper with pub/sub and reconnection
discovery.ts      Home Assistant MQTT Discovery - registers device and entities
state.ts          Maps OpenCode events to HA entity state updates
commands.ts       Handles incoming MQTT commands (permission responses, prompts, history)
notify.ts         Cross-platform terminal notification utilities (Kitty OSC 99)
```

**Data Flow:**
1. Plugin initializes on OpenCode startup, connects to MQTT
2. Device registration is **deferred** until a valid session title is received
3. `StateTracker` listens to OpenCode events via the `event` hook
4. When `hasValidSession()` becomes true, `Discovery` registers the device with HA
5. `CommandHandler` subscribes to command topic and processes commands via OpenCode client API
6. On shutdown (SIGINT/SIGTERM), plugin unregisters device from HA

**MQTT Topics:**
- Discovery: `homeassistant/sensor/opencode_{id}/{entity}/config`
- State: `opencode/opencode_{id}/{entity}`
- Attributes: `opencode/opencode_{id}/{entity}/attributes`
- Commands: `opencode/opencode_{id}/command`
- Response: `opencode/opencode_{id}/response`

**Key Types:**
- `EntityKey` - union of all entity keys (state, session_title, model, etc.)
- `PermissionInfo` - permission request details published as attributes
- `MqttWrapper` - interface for MQTT operations (publish, subscribe, close)
- `TrackedState` - internal state object with all tracked session properties

## Key Implementation Details

### Deferred Device Registration

The plugin waits until it has a valid session before registering with Home Assistant. This prevents creating entities with "unknown" in the name.

**Valid session criteria** (see `hasValidSession()` in state.ts):
- Session title is not empty
- Session title is not "No active session"
- Session title is not "Untitled"
- Session title is not "unknown"

### State Attributes

The `state` entity publishes these attributes:
- `previous_state` - for automation conditions (published BEFORE state value)
- `agent` - primary agent from user message
- `current_agent` - sub-agent from AgentPart (e.g., "explore", "general")
- `hostname` - machine hostname

### Publish Order for Automations

When state changes, attributes are published BEFORE the state value. This ensures that when HA automation triggers on the state MQTT topic, the `previous_state` attribute is already available.

### Graceful Shutdown

Plugin registers handlers for SIGINT and SIGTERM to:
1. Publish "offline" to availability topic
2. Unregister device from Home Assistant (publishes empty configs)
3. Close MQTT connection

### Availability Tracking

Entities are automatically marked as unavailable when the plugin disconnects:
- Uses MQTT Last Will and Testament (LWT) for crash detection
- Availability topic: `opencode/{deviceId}/availability`
- Payloads: "online" when connected, "offline" when disconnected
- Broker automatically publishes "offline" if connection drops unexpectedly

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

### Entity ID contains "unknown"
- The session title wasn't set before device registration
- Fixed by deferring registration until `hasValidSession()` returns true

### Automation not triggering
- Check that `previous_state` attribute is available when state changes
- Attributes are now published BEFORE state value
- Use the robust entity lookup pattern (by `state_topic_base` attribute)

### Kitty notifications not working
- Ensure terminal supports OSC 99 (Kitty, iTerm2)
- Check that stdout is a TTY

## Future Enhancements

### Multiple Session Support
Currently, the plugin tracks one session at a time per project. When switching sessions, the state updates to reflect the new active session. 

Potential enhancement: Track multiple concurrent sessions as separate HA devices or as a list attribute on the main device. This would require:
- Tracking a `Map<sessionId, SessionState>` instead of a single `TrackedState`
- Either creating dynamic entities per session, or publishing a sessions list attribute
- Handling session lifecycle (create, switch, delete) events
- Consider HA entity limits and cleanup when sessions are deleted
