# Quick Start

Get up and running with OpenCode Home Assistant integration in 5 minutes.

## Step 1: Install the Plugin

```bash
npm install -g ha-opencode
```

## Step 2: Configure MQTT

Create or edit your OpenCode configuration file:

=== "Project Config (opencode.json)"

    ```json
    {
      "plugins": {
        "ha-opencode": {
          "mqtt": {
            "host": "homeassistant.local",
            "port": 1883,
            "username": "mqtt_user",
            "password": "mqtt_password"
          }
        }
      }
    }
    ```

=== "Global Config (~/.config/opencode/config.json)"

    ```json
    {
      "plugins": {
        "ha-opencode": {
          "mqtt": {
            "host": "homeassistant.local",
            "port": 1883,
            "username": "mqtt_user",
            "password": "mqtt_password"
          }
        }
      }
    }
    ```

## Step 3: Start OpenCode

Launch OpenCode in your project directory:

```bash
cd your-project
opencode
```

You should see a message indicating the plugin has connected to MQTT.

## Step 4: Check Home Assistant

1. Go to **Settings** > **Devices & Services** > **MQTT**
2. Look for a new device named "OpenCode - [your-project]"
3. Click on it to see all available entities

## Step 5: Install the Companion Card (Optional)

For a beautiful dashboard experience, install the [OpenCode Card](../card/overview.md):

1. Download `opencode-card.js` from the [releases page](https://gitlab.com/opencode-home-assistant/opencode-card/-/releases)
2. Copy to `config/www/opencode-card.js`
3. Add to Lovelace resources
4. Add the card to your dashboard

## What You'll See

Once connected, you'll have access to:

| Entity | Description |
|--------|-------------|
| `sensor.opencode_*_state` | Current state (idle, working, waiting_permission) |
| `sensor.opencode_*_session_title` | Current session name |
| `sensor.opencode_*_model` | Active AI model |
| `sensor.opencode_*_current_tool` | Tool currently being used |
| `sensor.opencode_*_cost` | Session cost in USD |
| `sensor.opencode_*_tokens_input` | Input tokens used |
| `sensor.opencode_*_tokens_output` | Output tokens generated |

## Next Steps

- Set up [Blueprints](../blueprints/overview.md) for mobile notifications
- Learn about [Commands](../features/commands.md) you can send to OpenCode
- Configure [Permission handling](../features/permissions.md)
