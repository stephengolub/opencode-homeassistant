# Permissions

OpenCode requires explicit permission for certain operations. This plugin allows you to manage these permissions from Home Assistant.

## How Permissions Work

When OpenCode needs to perform a potentially dangerous action (like running a shell command), it:

1. Pauses execution
2. Publishes the permission request to MQTT
3. Waits for a response
4. Continues or aborts based on your decision

## Permission States

The `sensor.opencode_{device}_state` entity shows:

- `waiting_permission` - A permission request is pending

The `sensor.opencode_{device}_permission` entity shows:

- `none` - No pending permission
- `pending` - Permission awaiting response

## Permission Types

| Type | Description | Example |
|------|-------------|---------|
| `bash` | Shell command execution | `npm install`, `git push` |
| `edit` | File modification | Editing source files |
| `write` | File creation | Creating new files |
| `delete` | File deletion | Removing files |
| `mcp` | MCP tool invocation | External tool calls |

## Responding to Permissions

### From Home Assistant UI

Using the [OpenCode Card](../card/overview.md), you can click on permission alerts to:

- **Allow Once** - Permit this specific action
- **Always Allow** - Create a rule to auto-approve similar actions
- **Reject** - Deny the action

### Via MQTT Command

```yaml
service: mqtt.publish
data:
  topic: "opencode/opencode_myproject/command"
  payload: >
    {
      "command": "permission_response",
      "permission_id": "{{ state_attr('sensor.opencode_myproject_permission', 'permission_id') }}",
      "response": "once"
    }
```

### Via Automation

See [Blueprints](../blueprints/overview.md) for ready-to-use automations that send mobile notifications with actionable buttons.

## Permission Attributes

When a permission is pending, the permission sensor includes:

| Attribute | Description |
|-----------|-------------|
| `permission_id` | Unique identifier (required for response) |
| `type` | Permission category |
| `title` | Human-readable description |
| `session_id` | Associated session |
| `message_id` | Associated message |
| `pattern` | Command/file pattern (if applicable) |
| `metadata` | Additional context |

## Response Options

| Response | Effect |
|----------|--------|
| `once` | Allow this specific action only |
| `always` | Create a persistent rule to allow matching actions |
| `reject` | Deny the action, AI will try alternative approach |

### "Always" Rules

When you respond with `always`, OpenCode creates a rule that automatically approves future matching actions. This is useful for:

- Frequently used commands (`git status`, `npm test`)
- Trusted file patterns
- Safe operations

## Security Considerations

!!! warning "Review Before Approving"
    Always review permission requests before approving, especially:
    
    - Commands with `sudo` or elevated privileges
    - Commands that modify system files
    - Network-related commands
    - Commands with user input interpolation

!!! tip "Use Pattern Matching"
    The "Always Allow" option uses pattern matching. A rule for `npm *` will approve all npm commands, so use it judiciously.

## Example: Mobile Notification with Actions

Using the [Permission Response Blueprint](../blueprints/permission-response.md):

1. Phone receives notification: "OpenCode wants to run: npm install"
2. Tap "Allow Once" or "Always Allow"
3. Response is sent via MQTT
4. OpenCode continues execution

This enables hands-free coding while maintaining security control.
