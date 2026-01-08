# Commands

The plugin receives commands from Home Assistant via WebSocket. This enables automation scenarios and remote control.

## Available Commands

Commands are sent from Home Assistant using the integration's services. The plugin handles these commands:

### send_prompt

Send a text prompt to the OpenCode session.

| Field | Required | Description |
|-------|----------|-------------|
| `session_id` | Yes | Target session ID |
| `text` | Yes | The prompt text to send |
| `agent` | No | Specific agent to use |

**Example from Home Assistant:**

```yaml
service: opencode.send_prompt
data:
  session_id: ses_abc123
  text: "Fix the TypeScript errors in src/index.ts"
  agent: code
```

### respond_permission

Respond to a pending permission request.

| Field | Required | Description |
|-------|----------|-------------|
| `session_id` | Yes | Session with the pending permission |
| `permission_id` | Yes | ID of the permission request |
| `response` | Yes | `once`, `always`, or `reject` |

**Response options:**

- `once` - Allow this specific action only
- `always` - Allow all matching actions (creates a permission rule)
- `reject` - Deny the action

**Example:**

```yaml
service: opencode.respond_permission
data:
  session_id: ses_abc123
  permission_id: perm_xyz789
  response: once
```

### get_history

Retrieve the conversation history for a session.

| Field | Required | Description |
|-------|----------|-------------|
| `session_id` | Yes | Session to get history for |
| `since` | No | ISO timestamp to filter messages after |
| `request_id` | No | Correlation ID for the response |

**Response format:**

The plugin sends a `history_response` back to Home Assistant containing:

```json
{
  "session_id": "ses_abc123",
  "session_title": "Fix TypeScript errors",
  "messages": [
    {
      "id": "msg_1",
      "role": "user",
      "timestamp": "2025-01-07T10:00:00Z",
      "parts": [
        {"type": "text", "content": "Fix the errors"}
      ]
    },
    {
      "id": "msg_2",
      "role": "assistant",
      "timestamp": "2025-01-07T10:00:05Z",
      "model": "anthropic/claude-sonnet-4-20250514",
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

### get_agents

List available agents in OpenCode.

| Field | Required | Description |
|-------|----------|-------------|
| `session_id` | Yes | Any active session ID |
| `request_id` | No | Correlation ID for the response |

**Response format:**

```json
{
  "session_id": "ses_abc123",
  "agents": [
    {
      "name": "code",
      "description": "General purpose coding agent",
      "mode": "primary"
    },
    {
      "name": "explore",
      "description": "Codebase exploration agent",
      "mode": "subagent"
    }
  ]
}
```

## Message Parts

History messages contain parts of different types:

| Part Type | Description |
|-----------|-------------|
| `text` | Plain text content |
| `tool_call` | Tool invocation with name and arguments |
| `tool_result` | Result from a tool execution |
| `image` | Image or file reference |
| `other` | Other content types |

## Integration with Home Assistant

These commands are exposed as Home Assistant services by the [ha-opencode integration](https://github.com/stephengolub/ha-opencode). See the integration documentation for:

- Service definitions
- Automation examples
- Lovelace card integration
- Mobile notification blueprints
