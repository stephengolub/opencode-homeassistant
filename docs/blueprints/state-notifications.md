# State Notifications Blueprint

This blueprint sends mobile notifications when your OpenCode sessions need attention.

## What It Does

Sends notifications for:

- **Task Complete** - When OpenCode finishes working
- **Permission Required** - With actionable Approve/Reject buttons
- **Error** - When something goes wrong

## Prerequisites

- Home Assistant Companion App on your mobile device
- MQTT integration configured
- OpenCode plugin running

## Installation

### Import URL

```
https://gitlab.com/opencode-home-assistant/opencode-plugin/-/raw/main/blueprints/opencode_state_notifications.yaml
```

1. Go to **Settings** → **Automations & Scenes** → **Blueprints**
2. Click **Import Blueprint**
3. Paste the URL above
4. Click **Preview** then **Import**

### Manual Installation

Copy the blueprint file to:

```
config/blueprints/automation/opencode/opencode_state_notifications.yaml
```

## Creating the Automation

1. Go to **Settings** → **Automations & Scenes**
2. Click **Create Automation**
3. Select **Use Blueprint**
4. Choose "OpenCode State Notifications"
5. Configure the options:

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| **Notification Service** | `notify.mobile_app_phone` | Your mobile app notification service |
| **Notify on Task Complete** | `true` | Send notification when AI finishes |
| **Notify on Permission Required** | `true` | Send actionable notification for permissions |
| **Notify on Error** | `true` | Send notification on errors |
| **Notification Channel** | `OpenCode` | Android notification channel |
| **Dashboard Path** | `/lovelace/opencode` | Dashboard to open on tap |

## Finding Your Notification Service

1. Go to **Developer Tools** → **Services**
2. Search for "notify"
3. Look for `notify.mobile_app_your_device_name`

## Notification Examples

### Permission Required

```
Title: OpenCode: Permission Required
Message: my-project: Run: npm install

[Approve] [Reject]
```

Tapping "Approve" or "Reject" triggers the [Permission Response Blueprint](permission-response.md).

### Task Complete

```
Title: OpenCode: Task Complete
Message: my-project: Fixed TypeScript errors
```

### Error

```
Title: OpenCode: Error
Message: my-project: Build failed with exit code 1
```

## Android Notification Channel

Create a custom channel for fine-grained control:

1. Open Home Assistant Companion app
2. Go to **Settings** → **Notifications** → **Notification Channels**
3. Create a channel named "OpenCode"
4. Configure sound, vibration, importance

## Blueprint Source

```yaml
--8<-- "blueprints/opencode_state_notifications.yaml"
```

## Troubleshooting

### No Notifications Received

1. Check the notification service name is correct
2. Verify the Companion app has notification permissions
3. Check battery optimization isn't blocking the app
4. Look at system log for "ha-opencode.blueprint" entries

### Permission Buttons Not Working

Ensure you've also set up the [Permission Response Blueprint](permission-response.md).

### Notifications Delayed

1. Check Android battery optimization
2. Try setting importance to "high"
3. Verify MQTT connection is stable

## Related

- [Permission Response Blueprint](permission-response.md)
- [Permissions Documentation](../features/permissions.md)
- [Entities Reference](../features/entities.md)
