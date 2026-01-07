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

### Mobile Notifications for State Changes

Send notifications to your mobile device when any OpenCode session needs attention or completes work. This automation triggers directly on MQTT messages for efficiency, avoiding noisy state change events.

**Prerequisites:** You must have the MQTT integration configured and subscribe to the OpenCode topics. Add this to your `configuration.yaml`:

```yaml
mqtt:
  sensor:
    # This enables receiving MQTT messages for automation triggers
    # The actual OpenCode entities are auto-discovered, this just enables the trigger
```

```yaml
automation:
  - alias: "OpenCode State Notifications"
    description: "Notify when any OpenCode session needs attention or completes work"
    triggers:
      - platform: mqtt
        topic: "opencode/+/state"
    variables:
      # Extract the state topic base from the trigger (e.g., "opencode/opencode_abc123")
      state_topic_base: "{{ trigger.topic | replace('/state', '') }}"
      # Find the device_id entity that has this state_topic_base in its attributes
      # This is more robust than parsing the topic path to build entity IDs
      device_id_entity: >
        {{ states.sensor | selectattr('attributes.state_topic_base', 'defined')
           | selectattr('attributes.state_topic_base', 'eq', state_topic_base)
           | map(attribute='entity_id') | first | default('') }}
      # Derive other entity IDs from the device_id entity (replace _device_id suffix)
      entity_base: "{{ device_id_entity | replace('_device_id', '') }}"
      state_entity: "{{ entity_base }}_state"
      permission_entity: "{{ entity_base }}_permission"
      session_entity: "{{ entity_base }}_session_title"
      # Get values from entities
      previous_state: "{{ state_attr(state_entity, 'previous_state') }}"
      project_name: "{{ state_attr(device_id_entity, 'device_name') | default('OpenCode') }}"
      command_topic: "{{ state_attr(device_id_entity, 'command_topic') }}"
      # Device ID for notification tags
      device_id: "{{ states(device_id_entity) }}"
    condition:
      - condition: template
        value_template: >
          {{ device_id_entity != ''
             and trigger.payload in ['idle', 'waiting_permission', 'error']
             and previous_state == 'working' }}
    action:
      - choose:
          # Permission Required
          - conditions:
              - condition: template
                value_template: "{{ trigger.payload == 'waiting_permission' }}"
            sequence:
              # Small delay to let permission attributes arrive
              - delay:
                  milliseconds: 500
              - service: notify.mobile_app_your_phone
                data:
                  title: "OpenCode: Permission Required"
                  message: "{{ state_attr(permission_entity, 'title') | default('Permission needed') }}"
                  data:
                    tag: "opencode-permission-{{ device_id }}"
                    channel: "OpenCode"
                    importance: high
                    clickAction: "/lovelace/opencode"
                    actions:
                      - action: "OPENCODE_APPROVE_{{ device_id }}"
                        title: "Approve"
                      - action: "OPENCODE_REJECT_{{ device_id }}"
                        title: "Reject"
                    # Pass data needed for permission response
                    data:
                      device_id: "{{ device_id }}"
                      permission_id: "{{ state_attr(permission_entity, 'permission_id') }}"
                      command_topic: "{{ command_topic }}"

          # Error Occurred
          - conditions:
              - condition: template
                value_template: "{{ trigger.payload == 'error' }}"
            sequence:
              - service: notify.mobile_app_your_phone
                data:
                  title: "OpenCode: Error"
                  message: "{{ project_name }}: An error occurred"
                  data:
                    tag: "opencode-error-{{ device_id }}"
                    channel: "OpenCode"
                    importance: high

          # Work Complete (idle after working)
          - conditions:
              - condition: template
                value_template: "{{ trigger.payload == 'idle' }}"
            sequence:
              - service: notify.mobile_app_your_phone
                data:
                  title: "OpenCode: Task Complete"
                  message: "{{ project_name }}: {{ states(session_entity) }}"
                  data:
                    tag: "opencode-complete-{{ device_id }}"
                    channel: "OpenCode"

  # Handle notification actions for permission response
  - alias: "OpenCode Permission Response from Notification"
    description: "Handle approve/reject actions from mobile notifications"
    trigger:
      - platform: event
        event_type: mobile_app_notification_action
    condition:
      - condition: template
        value_template: >
          {{ trigger.event.data.action is defined and
             (trigger.event.data.action.startswith('OPENCODE_APPROVE_') or
              trigger.event.data.action.startswith('OPENCODE_REJECT_')) }}
    variables:
      is_approve: "{{ trigger.event.data.action.startswith('OPENCODE_APPROVE_') }}"
      response: "{{ 'once' if is_approve else 'reject' }}"
      # Get data passed from the notification
      command_topic: "{{ trigger.event.data.data.command_topic }}"
      permission_id: "{{ trigger.event.data.data.permission_id }}"
    action:
      - service: mqtt.publish
        data:
          topic: "{{ command_topic }}"
          payload: >
            {"command": "permission_response", "permission_id": "{{ permission_id }}", "response": "{{ response }}"}
```

### Alternative: Permission-Specific MQTT Trigger

For permission notifications specifically, you can trigger directly on the permission topic for faster response:

```yaml
automation:
  - alias: "OpenCode Permission Notification (Direct MQTT)"
    description: "Notify immediately when permission is requested via MQTT"
    trigger:
      - platform: mqtt
        topic: "opencode/+/permission"
        payload: "pending"
    variables:
      # Extract state topic base and find matching device_id entity
      state_topic_base: "{{ trigger.topic | replace('/permission', '') }}"
      device_id_entity: >
        {{ states.sensor | selectattr('attributes.state_topic_base', 'defined')
           | selectattr('attributes.state_topic_base', 'eq', state_topic_base)
           | map(attribute='entity_id') | first | default('') }}
      entity_base: "{{ device_id_entity | replace('_device_id', '') }}"
      permission_entity: "{{ entity_base }}_permission"
      command_topic: "{{ state_attr(device_id_entity, 'command_topic') }}"
      device_id: "{{ states(device_id_entity) }}"
    condition:
      - condition: template
        value_template: "{{ device_id_entity != '' }}"
    action:
      # Small delay to let attributes arrive
      - delay:
          milliseconds: 300
      - service: notify.mobile_app_your_phone
        data:
          title: "OpenCode: Permission Required"
          message: "{{ state_attr(permission_entity, 'title') | default('Permission needed') }}"
          data:
            tag: "opencode-permission-{{ device_id }}"
            channel: "OpenCode"
            importance: high
            actions:
              - action: "OPENCODE_APPROVE_{{ device_id }}"
                title: "Approve"
              - action: "OPENCODE_REJECT_{{ device_id }}"
                title: "Reject"
            data:
              device_id: "{{ device_id }}"
              permission_id: "{{ state_attr(permission_entity, 'permission_id') }}"
              command_topic: "{{ command_topic }}"
```

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
