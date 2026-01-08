# Configuration

The OpenCode Home Assistant plugin stores connection configuration after the initial pairing process.

## Configuration Storage

After pairing with Home Assistant, the plugin stores connection details in:

```
~/.config/opencode/ha-config.json
```

This file is created automatically during pairing and contains:

```json
{
  "url": "ws://homeassistant.local:8123/api/websocket",
  "accessToken": "your-long-lived-access-token",
  "instanceToken": "generated-during-pairing",
  "instanceId": "instance_abc123def456"
}
```

!!! warning "Security Note"
    This file contains sensitive credentials. Ensure it has appropriate file permissions (`chmod 600`).

## Environment Variables

You can also configure the plugin via environment variables:

| Variable | Description |
|----------|-------------|
| `OPENCODE_HA_URL` | Home Assistant URL (e.g., `http://homeassistant.local:8123`) |
| `OPENCODE_HA_ACCESS_TOKEN` | Long-lived access token |

Environment variables are useful for CI/CD environments or when you don't want credentials in a config file.

```bash
export OPENCODE_HA_URL=http://homeassistant.local:8123
export OPENCODE_HA_ACCESS_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Configuration Priority

The plugin loads configuration in this order (later values override earlier):

1. Default values
2. Environment variables (`OPENCODE_HA_URL`, `OPENCODE_HA_ACCESS_TOKEN`)
3. Config file (`~/.config/opencode/ha-config.json`)

## Re-pairing

If you need to re-pair with Home Assistant (e.g., changed URL, new access token):

1. Delete the config file:
   ```bash
   rm ~/.config/opencode/ha-config.json
   ```

2. Restart OpenCode

3. Follow the [pairing process](pairing.md) again

## Multiple Home Assistant Instances

The plugin currently supports connection to a single Home Assistant instance. The instance is identified by the `instanceToken` generated during pairing.

If you need to switch between Home Assistant instances:

1. Delete the existing config file
2. Re-pair with the new instance
