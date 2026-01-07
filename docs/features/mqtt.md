# MQTT Integration

The plugin communicates with Home Assistant entirely through MQTT, using Home Assistant's MQTT Discovery protocol for automatic device registration.

## Topic Structure

All topics follow this pattern:

```
opencode/{device_id}/{entity_type}
```

### Discovery Topics

Discovery messages are published to:

```
homeassistant/{component}/opencode_{device_id}/{entity}/config
```

### State Topics

State updates are published to:

```
opencode/{device_id}/state
opencode/{device_id}/session_title
opencode/{device_id}/model
opencode/{device_id}/current_tool
opencode/{device_id}/cost
opencode/{device_id}/tokens_input
opencode/{device_id}/tokens_output
opencode/{device_id}/last_activity
opencode/{device_id}/permission
```

### Command Topic

Commands from Home Assistant are received on:

```
opencode/{device_id}/command
```

### Response Topic

Responses (like chat history) are published to:

```
opencode/{device_id}/response
```

## Message Formats

### State Updates

State messages are simple string values:

```json
"working"
```

Possible states: `idle`, `working`, `waiting_permission`, `error`

### Permission Entity

When a permission is pending:

```json
{
  "state": "pending",
  "attributes": {
    "permission_id": "perm-123",
    "type": "bash",
    "title": "Run: npm install",
    "session_id": "sess-456",
    "message_id": "msg-789",
    "pattern": "npm *"
  }
}
```

### Command Messages

Commands sent to the plugin:

```json
{
  "command": "prompt",
  "text": "Fix the bug in index.ts",
  "agent": "default"
}
```

## Retained Messages

The following topics use retained messages for state persistence:

- All state topics (sensor values)
- Discovery configuration messages

This ensures Home Assistant receives the current state even after a restart.

## QoS Levels

- Discovery messages: QoS 1 (at least once)
- State updates: QoS 0 (at most once)
- Commands: QoS 1 (at least once)

## Connection Handling

The plugin handles MQTT connection issues gracefully:

- Automatic reconnection with exponential backoff
- State restoration after reconnection
- Graceful cleanup on shutdown (publishes offline availability)
