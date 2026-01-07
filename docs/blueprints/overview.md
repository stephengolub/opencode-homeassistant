# Blueprints

Home Assistant Blueprints are pre-built automations that you can import and configure without writing YAML. We provide blueprints to help you get the most out of the OpenCode integration.

## Available Blueprints

### Permission Response

Send mobile notifications with actionable buttons when OpenCode needs permission.

**Features**:

- Push notification to your phone
- "Allow Once", "Always Allow", "Reject" buttons
- Works with iOS and Android

[View Blueprint →](permission-response.md)

### State Notifications

Get notified when OpenCode state changes (starts working, finishes, errors).

**Features**:

- Customizable notification triggers
- Optional "task complete" notifications
- Error alerts

[View Blueprint →](state-notifications.md)

## Installing Blueprints

### Method 1: Import URL

1. Go to **Settings** → **Automations & Scenes** → **Blueprints**
2. Click **Import Blueprint**
3. Paste the blueprint URL
4. Click **Preview** then **Import**

### Method 2: Manual Installation

1. Download the blueprint YAML file
2. Copy to `config/blueprints/automation/opencode/`
3. Restart Home Assistant

## Blueprint Files

The blueprint files are included in the plugin repository:

```
blueprints/
├── opencode_permission_response.yaml
└── opencode_state_notifications.yaml
```

## Creating Automations from Blueprints

1. Go to **Settings** → **Automations & Scenes**
2. Click **Create Automation**
3. Select **Use Blueprint**
4. Choose the OpenCode blueprint
5. Configure the required inputs
6. Save

## Custom Automations

While blueprints cover common scenarios, you can create custom automations using:

- OpenCode sensor entities
- MQTT publish service
- Template conditions

See [Commands](../features/commands.md) for the full command reference.
