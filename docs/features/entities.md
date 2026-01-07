# Home Assistant Entities

The plugin creates a device in Home Assistant with multiple sensor entities for monitoring your OpenCode session.

## Device Information

Each OpenCode instance creates a device with:

- **Name**: "OpenCode - [project-name]"
- **Manufacturer**: OpenCode
- **Model**: AI Coding Assistant
- **Identifiers**: Unique device ID based on project and hostname

## Sensor Entities

### State Sensor

**Entity ID**: `sensor.opencode_{device}_state`

Current state of the OpenCode session.

| State | Icon | Description |
|-------|------|-------------|
| `idle` | `mdi:sleep` | No active task |
| `working` | `mdi:cog` | AI is processing |
| `waiting_permission` | `mdi:shield-alert` | Awaiting permission approval |
| `error` | `mdi:alert-circle` | An error occurred |

**Attributes**:

- `agent`: Primary agent name
- `current_agent`: Currently active agent (may differ during sub-agent calls)
- `hostname`: Machine hostname

### Session Title Sensor

**Entity ID**: `sensor.opencode_{device}_session_title`

The title/description of the current session.

### Model Sensor

**Entity ID**: `sensor.opencode_{device}_model`

The AI model currently in use (e.g., `claude-sonnet-4-20250514`).

### Current Tool Sensor

**Entity ID**: `sensor.opencode_{device}_current_tool`

The tool currently being executed. Shows `none` when idle.

Common tools:

- `Read` - Reading files
- `Edit` - Editing files
- `Write` - Writing files
- `Bash` - Running shell commands
- `Glob` - Finding files
- `Grep` - Searching file contents
- `Task` - Spawning sub-agents

### Cost Sensor

**Entity ID**: `sensor.opencode_{device}_cost`

Session cost in USD. Updates in real-time as tokens are consumed.

**Attributes**:

- `unit_of_measurement`: `USD`
- `state_class`: `total_increasing`

### Token Sensors

**Entity IDs**:

- `sensor.opencode_{device}_tokens_input`
- `sensor.opencode_{device}_tokens_output`

Track token usage for the session.

**Attributes**:

- `unit_of_measurement`: `tokens`
- `state_class`: `total_increasing`

### Last Activity Sensor

**Entity ID**: `sensor.opencode_{device}_last_activity`

ISO 8601 timestamp of the last activity. Useful for automations and sorting.

### Permission Sensor

**Entity ID**: `sensor.opencode_{device}_permission`

Shows `pending` when a permission request is waiting, `none` otherwise.

**Attributes** (when pending):

- `permission_id`: Unique permission identifier
- `type`: Permission type (e.g., `bash`, `edit`, `write`)
- `title`: Human-readable description
- `session_id`: Associated session
- `message_id`: Associated message
- `pattern`: Permission pattern (if applicable)

### Device ID Sensor

**Entity ID**: `sensor.opencode_{device}_device_id`

Internal device identifier.

**Attributes**:

- `command_topic`: MQTT topic for sending commands
- `response_topic`: MQTT topic for receiving responses

## Using Entities in Automations

Example automation trigger for permission requests:

```yaml
trigger:
  - platform: state
    entity_id: sensor.opencode_myproject_state
    to: "waiting_permission"
action:
  - service: notify.mobile_app
    data:
      title: "OpenCode Permission Required"
      message: "{{ state_attr('sensor.opencode_myproject_permission', 'title') }}"
```

See [Blueprints](../blueprints/overview.md) for ready-to-use automations.
