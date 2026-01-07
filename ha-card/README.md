# OpenCode Card for Home Assistant

A custom Lovelace card that displays OpenCode AI coding assistant sessions and allows interaction via MQTT.

## Features

- **Session List View**: Shows all active OpenCode sessions with status, model, and current tool
- **Detail View**: Detailed session information including token counts, cost, and last activity
- **Permission Handling**: Approve or reject permission requests directly from Home Assistant
- **Send Prompts**: Send prompts to OpenCode sessions via MQTT
- **Session History**: View conversation history with lazy loading for performance
- **Real-time Updates**: Live status updates via MQTT

## Installation

### 1. Copy the card file

Copy `dist/opencode-card.js` to your Home Assistant `www` folder:

```bash
cp dist/opencode-card.js /config/www/opencode-card.js
```

### 2. Add as a resource

Add the card as a resource in Home Assistant:

**Via UI:**
1. Go to Settings > Dashboards
2. Click the three dots menu > Resources
3. Click "Add Resource"
4. URL: `/local/opencode-card.js`
5. Type: JavaScript Module

**Via YAML** (in `configuration.yaml`):
```yaml
lovelace:
  resources:
    - url: /local/opencode-card.js
      type: module
```

### 3. Add the card to a dashboard

```yaml
type: custom:opencode-card
title: OpenCode Sessions  # Optional, defaults to "OpenCode Sessions"
device: abc123           # Optional, pin to specific device ID
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | string | "OpenCode Sessions" | Card title (hidden when pinned to device) |
| `device` | string | - | Device ID to pin to (shows detail view only) |

## States

The card displays these session states:

| State | Icon | Color | Description |
|-------|------|-------|-------------|
| `idle` | sleep | green | Session is idle, waiting for input |
| `working` | cog (animated) | blue | AI is actively working |
| `waiting_permission` | shield-alert | orange | Waiting for permission approval |
| `error` | alert-circle | red | An error occurred |

## Entities Created

The OpenCode plugin creates these entities per session:

| Entity | Description |
|--------|-------------|
| `sensor.opencode_*_state` | Current session state |
| `sensor.opencode_*_session_title` | Session/conversation title |
| `sensor.opencode_*_model` | AI model being used |
| `sensor.opencode_*_current_tool` | Currently executing tool |
| `sensor.opencode_*_tokens_input` | Input token count |
| `sensor.opencode_*_tokens_output` | Output token count |
| `sensor.opencode_*_cost` | Session cost in USD |
| `sensor.opencode_*_last_activity` | Timestamp of last activity |
| `sensor.opencode_*_permission` | Permission request status |
| `sensor.opencode_*_device_id` | Device identifier with command topic |

## Automations

### Using Blueprints (Recommended)

The easiest way to set up OpenCode notifications is using the provided automation blueprints. These work with both **iOS** and **Android** devices via the Home Assistant Companion app.

#### Installation

1. Copy the blueprint files to your Home Assistant config:
   ```bash
   # From the ha-opencode directory
   cp blueprints/*.yaml /config/blueprints/automation/opencode/
   ```

   Or create the files manually in Home Assistant:
   - Go to **Settings > Automations & Scenes > Blueprints**
   - Click **Import Blueprint** (or create manually)

2. Create automations from the blueprints:
   - Go to **Settings > Automations & Scenes > Create Automation**
   - Click **Use Blueprint**
   - Select **OpenCode State Notifications**
   - Choose your mobile device
   - Save

3. Create the permission response handler:
   - Create another automation from **OpenCode Permission Response Handler**
   - No configuration needed - just save it

#### Available Blueprints

| Blueprint | Description |
|-----------|-------------|
| `opencode_state_notifications.yaml` | Sends notifications for task complete, permission required, and errors |
| `opencode_permission_response.yaml` | Handles approve/reject button taps from notifications |

#### Blueprint Options

**OpenCode State Notifications:**
- **Notification Target**: Your mobile device (iOS or Android)
- **Notify on Complete**: Enable/disable task completion notifications
- **Notify on Permission**: Enable/disable permission request notifications
- **Notify on Error**: Enable/disable error notifications
- **Notification Channel**: Android channel name (ignored on iOS)
- **Dashboard Path**: Where to navigate when notification is tapped

### Manual Setup (Alternative)

If you prefer to create automations manually, see the full YAML examples in the `blueprints/` directory. The key components are:

1. **MQTT Trigger**: Listen to `opencode/+/state` for state changes
2. **Entity Lookup**: Find the device by matching `state_topic_base` attribute
3. **Conditional Notifications**: Different actions for idle, permission, error states
4. **Permission Response**: Handle `mobile_app_notification_action` events

### Cost Tracking

Track and alert on AI costs across all OpenCode sessions:

```yaml
# Template sensor to sum costs across all OpenCode sessions
template:
  - sensor:
      - name: "OpenCode Total Cost"
        unit_of_measurement: "USD"
        state_class: total_increasing
        state: >
          {% set ns = namespace(total=0) %}
          {% for state in states.sensor
             if state.entity_id.startswith('sensor.opencode_')
             and state.entity_id.endswith('_cost') %}
            {% set ns.total = ns.total + (state.state | float(0)) %}
          {% endfor %}
          {{ ns.total | round(4) }}

automation:
  - alias: "OpenCode Cost Alert"
    description: "Alert when any session cost exceeds threshold"
    trigger:
      - platform: numeric_state
        entity_id:
          - sensor.opencode_*_cost
        above: 1.00  # Alert when cost exceeds $1
    variables:
      device_prefix: "{{ trigger.entity_id | replace('_cost', '') }}"
      device_id_entity: "{{ device_prefix }}_device_id"
      project_name: >
        {{ state_attr(device_id_entity, 'device_name') | default('OpenCode') }}
    action:
      - service: notify.mobile_app_your_phone
        data:
          title: "OpenCode: Cost Alert"
          message: "{{ project_name }} cost: ${{ trigger.to_state.state | round(2) }}"
```

## Building from Source

```bash
cd ha-card
npm install
npm run build
```

For development with auto-rebuild:

```bash
npm run dev
```

## Requirements

- Home Assistant 2023.1 or later
- MQTT integration configured
- OpenCode with ha-opencode plugin installed and connected to MQTT

## Troubleshooting

### Card not appearing
1. Check browser console for JavaScript errors
2. Verify the resource is loaded (Developer Tools > Network)
3. Clear browser cache and reload

### No devices showing
1. Verify MQTT is connected in Home Assistant
2. Check that the ha-opencode plugin is running
3. Look for OpenCode devices in Settings > Devices

### Permission buttons not working
1. Check browser console for errors
2. Verify the command_topic attribute is set on the device_id entity
3. Test MQTT publishing manually via Developer Tools > Services

## License

MIT
