# Permission Response Blueprint

This blueprint handles permission responses from mobile notification actions.

## What It Does

When you receive a permission notification on your phone and tap "Approve" or "Reject", this automation:

1. Captures the button tap event
2. Extracts the permission details
3. Sends the response to OpenCode via MQTT

## Prerequisites

- Home Assistant Companion App on your mobile device
- MQTT integration configured
- [State Notifications Blueprint](state-notifications.md) for sending the notifications

## Installation

### Import URL

```
https://gitlab.com/opencode-home-assistant/opencode-plugin/-/raw/main/blueprints/opencode_permission_response.yaml
```

1. Go to **Settings** → **Automations & Scenes** → **Blueprints**
2. Click **Import Blueprint**
3. Paste the URL above
4. Click **Preview** then **Import**

### Manual Installation

Copy the blueprint file to:

```
config/blueprints/automation/opencode/opencode_permission_response.yaml
```

## Creating the Automation

1. Go to **Settings** → **Automations & Scenes**
2. Click **Create Automation**
3. Select **Use Blueprint**
4. Choose "OpenCode Permission Response Handler"
5. Save (no configuration needed)

## How It Works

The blueprint listens for `mobile_app_notification_action` events with actions starting with:

- `OPENCODE_APPROVE_*` → Sends `response: "once"`
- `OPENCODE_REJECT_*` → Sends `response: "reject"`

The notification must include action data with:

- `command_topic` - MQTT topic to publish response
- `permission_id` - Permission identifier

## Blueprint Source

```yaml
--8<-- "blueprints/opencode_permission_response.yaml"
```

## Troubleshooting

### Button Taps Not Working

1. Check the system log for "ha-opencode.permission" entries
2. Verify the notification includes correct action data
3. Ensure MQTT is connected

### "Always Allow" Not Working

The current notification blueprint only sends "once" responses. To implement "always":

1. Modify the State Notifications blueprint to include an "Always" button
2. Update this blueprint to handle `OPENCODE_ALWAYS_*` actions

## Related

- [State Notifications Blueprint](state-notifications.md)
- [Permissions Documentation](../features/permissions.md)
