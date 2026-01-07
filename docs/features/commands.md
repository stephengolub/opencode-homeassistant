# Commands

You can send commands to OpenCode through MQTT. This enables automation scenarios and remote control from Home Assistant.

## Sending Commands

Commands are sent as JSON to the device's command topic:

```
opencode/{device_id}/command
```

### Using Home Assistant Service

```yaml
service: mqtt.publish
data:
  topic: "opencode/opencode_myproject/command"
  payload: '{"command": "prompt", "text": "Fix the TypeScript errors"}'
```

## Available Commands

### prompt

Send a prompt to the AI assistant.

```json
{
  "command": "prompt",
  "text": "Your prompt text here",
  "agent": "optional-agent-name",
  "session_id": "optional-session-id"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `text` | Yes | The prompt to send |
| `agent` | No | Specific agent to use |
| `session_id` | No | Target session (defaults to current) |

### permission_response

Respond to a pending permission request.

```json
{
  "command": "permission_response",
  "permission_id": "perm-123",
  "response": "once"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `permission_id` | Yes | ID from the permission sensor |
| `response` | Yes | `once`, `always`, or `reject` |

**Response options**:

- `once` - Allow this specific action
- `always` - Allow all matching actions (creates a permission rule)
- `reject` - Deny the action

### get_history

Retrieve the chat history for a session.

```json
{
  "command": "get_history",
  "session_id": "optional-session-id",
  "request_id": "optional-correlation-id"
}
```

Response is published to the response topic.

### get_history_since

Get history messages after a specific timestamp.

```json
{
  "command": "get_history_since",
  "since": "2025-01-07T10:00:00Z",
  "session_id": "optional-session-id",
  "request_id": "optional-correlation-id"
}
```

### get_agents

List available agents.

```json
{
  "command": "get_agents",
  "request_id": "optional-correlation-id"
}
```

Response:

```json
{
  "type": "agents",
  "request_id": "...",
  "agents": [
    {
      "name": "default",
      "description": "General purpose agent",
      "mode": "primary"
    }
  ]
}
```

### cleanup_stale_sessions

Clean up old session data from Home Assistant.

```json
{
  "command": "cleanup_stale_sessions",
  "max_age_days": 7
}
```

## Response Format

Responses to commands like `get_history` are published to:

```
opencode/{device_id}/response
```

### History Response

```json
{
  "type": "history",
  "request_id": "...",
  "session_id": "sess-123",
  "session_title": "Fix TypeScript errors",
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "timestamp": "2025-01-07T10:00:00Z",
      "parts": [
        {"type": "text", "content": "Fix the errors"}
      ]
    },
    {
      "id": "msg-2",
      "role": "assistant",
      "timestamp": "2025-01-07T10:00:05Z",
      "model": "claude-sonnet-4-20250514",
      "tokens_input": 1000,
      "tokens_output": 500,
      "cost": 0.015,
      "parts": [
        {"type": "text", "content": "I'll fix those errors..."},
        {"type": "tool_call", "tool_name": "Edit", "tool_args": {...}}
      ]
    }
  ],
  "fetched_at": "2025-01-07T10:05:00Z"
}
```

## Automation Examples

### Voice-triggered Prompt

```yaml
automation:
  - alias: "Voice command to OpenCode"
    trigger:
      - platform: conversation
        command: "Tell opencode to {prompt}"
    action:
      - service: mqtt.publish
        data:
          topic: "opencode/opencode_myproject/command"
          payload: >
            {"command": "prompt", "text": "{{ trigger.slots.prompt }}"}
```

### Auto-approve Safe Commands

```yaml
automation:
  - alias: "Auto-approve git status"
    trigger:
      - platform: state
        entity_id: sensor.opencode_myproject_permission
        to: "pending"
    condition:
      - condition: template
        value_template: >
          {{ state_attr('sensor.opencode_myproject_permission', 'title') | regex_match('git status') }}
    action:
      - service: mqtt.publish
        data:
          topic: "opencode/opencode_myproject/command"
          payload: >
            {
              "command": "permission_response",
              "permission_id": "{{ state_attr('sensor.opencode_myproject_permission', 'permission_id') }}",
              "response": "once"
            }
```
