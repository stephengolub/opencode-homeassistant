# ha-opencode

OpenCode plugin for Home Assistant integration via MQTT Discovery.

Exposes OpenCode session state as Home Assistant entities and allows bidirectional control (responding to permission requests, sending prompts, viewing history).

## Features

- **Real-time State Tracking**: Session state, model, current tool, tokens, and cost
- **Permission Handling**: Approve/reject permission requests from HA or mobile notifications
- **Send Prompts**: Send prompts to OpenCode sessions via MQTT
- **Session History**: Retrieve conversation history on demand
- **Agent Tracking**: Track primary agent and sub-agents being used
- **Hostname Display**: Identify which machine the session is running on

## Installation

### 1. Install the plugin

```bash
npm install --prefix ~/.config/opencode /path/to/ha-opencode
```

### 2. Add to OpenCode config

Add `"ha-opencode"` to the `plugins` array in `~/.config/opencode/opencode.json`:

```json
{
  "plugins": ["ha-opencode"]
}
```

### 3. Configure MQTT connection

Via environment variables:

```bash
export MQTT_HOST=your-mqtt-broker.local
export MQTT_PORT=1883
export MQTT_USERNAME=optional-username
export MQTT_PASSWORD=optional-password
export HA_DISCOVERY_PREFIX=homeassistant  # default
```

Or via `opencode.json`:

```json
{
  "plugins": ["ha-opencode"],
  "ha-opencode": {
    "mqtt": {
      "host": "your-mqtt-broker.local",
      "port": 1883,
      "username": "optional-username",
      "password": "optional-password"
    },
    "ha": {
      "discoveryPrefix": "homeassistant"
    }
  }
}
```

Environment variables take precedence over JSON config.

## Entities Created

Per OpenCode session (device), the following entities are created:

| Entity | Type | Description |
|--------|------|-------------|
| `sensor.opencode_*_state` | Sensor | Session state (idle, working, waiting_permission, error) |
| `sensor.opencode_*_session_title` | Sensor | Current session/conversation title |
| `sensor.opencode_*_model` | Sensor | AI model being used (provider/model) |
| `sensor.opencode_*_current_tool` | Sensor | Currently executing tool |
| `sensor.opencode_*_tokens_input` | Sensor | Input token count |
| `sensor.opencode_*_tokens_output` | Sensor | Output token count |
| `sensor.opencode_*_cost` | Sensor | Session cost in USD |
| `sensor.opencode_*_last_activity` | Sensor | Timestamp of last activity |
| `sensor.opencode_*_permission` | Sensor | Permission request status |
| `sensor.opencode_*_device_id` | Sensor | Device identifier with command/response topics |

### State Entity Attributes

The `state` entity includes these attributes:

- `previous_state`: The state before the current one (for automation conditions)
- `agent`: Primary agent selected by the user
- `current_agent`: Sub-agent currently being used (if any)
- `hostname`: Machine hostname where OpenCode is running

### Device ID Entity Attributes

The `device_id` entity includes:

- `command_topic`: MQTT topic for sending commands
- `response_topic`: MQTT topic for receiving responses
- `state_topic_base`: Base topic for all state updates
- `device_name`: Friendly device name

## MQTT Commands

Send commands to the `command_topic` (e.g., `opencode/opencode_myproject/command`):

### Permission Response

```json
{
  "command": "permission_response",
  "permission_id": "perm-123",
  "response": "once"  // "once", "always", or "reject"
}
```

### Send Prompt

```json
{
  "command": "prompt",
  "text": "Your prompt text here",
  "session_id": "optional-session-id"
}
```

### Get History

```json
{
  "command": "get_history",
  "session_id": "optional-session-id",
  "request_id": "optional-correlation-id"
}
```

### Get History Since

```json
{
  "command": "get_history_since",
  "since": "2024-01-01T00:00:00Z",
  "session_id": "optional-session-id",
  "request_id": "optional-correlation-id"
}
```

## Home Assistant Card

A custom Lovelace card is included for displaying OpenCode sessions in Home Assistant.

See [ha-card/README.md](ha-card/README.md) for installation and usage instructions.

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode
npm run dev
```

### Project Structure

```
src/
  index.ts      Plugin entry point
  config.ts     Configuration loading (env vars + JSON)
  mqtt.ts       MQTT client wrapper
  discovery.ts  Home Assistant MQTT Discovery
  state.ts      State tracking and publishing
  commands.ts   MQTT command handler
  notify.ts     Terminal notification utilities

ha-card/
  src/          Custom Lovelace card source
  dist/         Built card JS
```

## License

MIT
