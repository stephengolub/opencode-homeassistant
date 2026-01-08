# Permissions

OpenCode requires explicit permission for certain operations. This plugin allows you to manage these permissions from Home Assistant.

## How Permissions Work

When OpenCode needs to perform a potentially dangerous action (like running a shell command), it:

1. Pauses execution
2. Sends the permission request to Home Assistant via WebSocket
3. Waits for a response
4. Continues or aborts based on your decision

## Permission States

The session state changes to `waiting_permission` when a permission is pending.

A dedicated binary sensor (`binary_sensor.*_permission_pending`) indicates whether a permission is waiting for response.

## Permission Types

| Type | Description | Example |
|------|-------------|---------|
| `bash` | Shell command execution | `npm install`, `git push` |
| `edit` | File modification | Editing source files |
| `write` | File creation | Creating new files |
| `delete` | File deletion | Removing files |
| `mcp` | MCP tool invocation | External tool calls |

## Responding to Permissions

### From Home Assistant

Using the [ha-opencode integration](https://github.com/stephengolub/ha-opencode):

**Via Service:**

```yaml
service: opencode.respond_permission
data:
  session_id: ses_abc123
  permission_id: perm_xyz789
  response: once
```

**Via Lovelace Card:**

The OpenCode card shows permission details with Approve/Reject buttons.

**Via Mobile Notification:**

Using the included blueprints, you can receive notifications with actionable buttons.

### Via Automation

See the [ha-opencode blueprints](https://github.com/stephengolub/ha-opencode/tree/main/blueprints) for ready-to-use automations.

## Permission Details

When a permission is pending, the following information is available:

| Field | Description |
|-------|-------------|
| `permission_id` | Unique identifier (required for response) |
| `type` | Permission category (bash, edit, etc.) |
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

!!! tip "Use Pattern Matching Wisely"
    The "Always Allow" option uses pattern matching. A rule for `npm *` will approve all npm commands, so use it judiciously.

## Example: Mobile Notification with Actions

Using the blueprints from [ha-opencode](https://github.com/stephengolub/ha-opencode):

1. Phone receives notification: "OpenCode wants to run: npm install"
2. Notification includes permission type, title, and pattern
3. Tap "Approve" or "Reject"
4. Response is sent to OpenCode via WebSocket
5. OpenCode continues or aborts based on your decision

This enables hands-free coding while maintaining security control.
