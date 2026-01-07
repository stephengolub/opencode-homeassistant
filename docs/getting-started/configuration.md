# Configuration

The OpenCode Home Assistant plugin can be configured through OpenCode's plugin configuration system.

## Configuration File

Add your configuration to `opencode.json` in your project root, or to the global config at `~/.config/opencode/config.json`:

```json
{
  "plugins": {
    "ha-opencode": {
      "mqtt": {
        "host": "localhost",
        "port": 1883,
        "username": "mqtt_user",
        "password": "mqtt_password",
        "protocol": "mqtt"
      },
      "homeAssistant": {
        "discoveryPrefix": "homeassistant",
        "topicPrefix": "opencode"
      },
      "device": {
        "name": "My Project",
        "identifier": "custom-device-id"
      }
    }
  }
}
```

## Configuration Options

### MQTT Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mqtt.host` | string | `localhost` | MQTT broker hostname |
| `mqtt.port` | number | `1883` | MQTT broker port |
| `mqtt.username` | string | - | MQTT authentication username |
| `mqtt.password` | string | - | MQTT authentication password |
| `mqtt.protocol` | string | `mqtt` | Protocol: `mqtt`, `mqtts`, `ws`, `wss` |

### Home Assistant Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `homeAssistant.discoveryPrefix` | string | `homeassistant` | HA MQTT discovery prefix |
| `homeAssistant.topicPrefix` | string | `opencode` | Prefix for all plugin topics |

### Device Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `device.name` | string | Project folder name | Display name in Home Assistant |
| `device.identifier` | string | Auto-generated | Unique device identifier |

## Environment Variables

You can also configure MQTT credentials via environment variables:

```bash
export MQTT_HOST=your-broker.local
export MQTT_PORT=1883
export MQTT_USERNAME=user
export MQTT_PASSWORD=secret
```

Environment variables take precedence over configuration file values for sensitive data.

## TLS/SSL Configuration

For secure MQTT connections:

```json
{
  "plugins": {
    "ha-opencode": {
      "mqtt": {
        "host": "secure-broker.example.com",
        "port": 8883,
        "protocol": "mqtts",
        "rejectUnauthorized": true
      }
    }
  }
}
```

## Multiple Projects

Each OpenCode instance automatically creates a unique device in Home Assistant based on:

1. Project directory name
2. Hostname of the machine
3. Optional custom identifier

This allows monitoring multiple projects simultaneously.
