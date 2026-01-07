# Installation

This guide walks you through installing the OpenCode Home Assistant plugin.

## Prerequisites

Before installing, ensure you have:

- **Home Assistant** with MQTT integration configured and running
- **OpenCode** AI coding assistant installed
- **Node.js 18+** installed on the machine running OpenCode
- **MQTT Broker** accessible from both Home Assistant and your development machine

## Installation Methods

### Method 1: npm (Recommended)

```bash
npm install -g ha-opencode
```

### Method 2: From Source

```bash
git clone https://gitlab.com/opencode-home-assistant/opencode-plugin.git
cd opencode-plugin
npm install
npm run build
npm link
```

## Configuring OpenCode

Add the plugin to your OpenCode configuration file (`opencode.json` or `~/.config/opencode/config.json`):

```json
{
  "plugins": {
    "ha-opencode": {
      "mqtt": {
        "host": "your-mqtt-broker.local",
        "port": 1883,
        "username": "mqtt_user",
        "password": "mqtt_password"
      }
    }
  }
}
```

## Verifying Installation

1. Start OpenCode in any project directory
2. Check Home Assistant for new MQTT devices
3. You should see a new device named "OpenCode - [project-name]"

## Next Steps

- [Configure the plugin](configuration.md) with your specific settings
- [Quick Start Guide](quick-start.md) to get up and running
- Install the [Companion Card](../card/overview.md) for a beautiful dashboard
