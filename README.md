# OpenCode Home Assistant Plugin

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/brand/opencode-wordmark-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="docs/assets/brand/opencode-wordmark-light.png">
    <img alt="OpenCode" src="docs/assets/brand/opencode-wordmark-light.png" width="300">
  </picture>
</p>

<p align="center">
  <strong>Unofficial Home Assistant Plugin for OpenCode</strong>
</p>

<p align="center">
  <a href="https://stephengolub.github.io/opencode-homeassistant"><img src="https://img.shields.io/badge/docs-GitHub%20Pages-blue" alt="Documentation"></a>
  <a href="https://github.com/stephengolub/opencode-homeassistant/releases"><img src="https://img.shields.io/github/v/release/stephengolub/opencode-homeassistant" alt="GitHub Release"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
</p>

---

> **Note:** This is an **unofficial** community project and is not affiliated with, endorsed by, or supported by OpenCode or Anomaly. OpenCode branding is used in accordance with their [brand guidelines](https://opencode.ai/brand).

---

OpenCode plugin that enables real-time integration with Home Assistant via native WebSocket connection.

Monitor and control your OpenCode sessions directly from Home Assistant - get notified when tasks complete, approve permissions from your phone, and even send prompts remotely.

**[Full Documentation](https://stephengolub.github.io/opencode-homeassistant)** | **[Home Assistant Integration](https://github.com/stephengolub/ha-opencode)**

## Features

- **Native WebSocket**: Direct connection to Home Assistant - no MQTT broker required
- **Secure Pairing**: Simple one-time pairing flow with secure token authentication
- **Real-time Updates**: Instant session state, model, tool, token, and cost updates
- **Permission Handling**: Approve/reject tool permissions from Home Assistant or mobile notifications
- **Session History**: Retrieve full conversation history on demand
- **Multi-session Support**: Each session gets its own device in Home Assistant
- **Auto-reconnect**: Persistent connection with automatic reconnection

## Requirements

- [OpenCode](https://opencode.ai) AI coding assistant
- [Home Assistant](https://www.home-assistant.io/) with the companion integration installed:
  - **[ha-opencode](https://github.com/stephengolub/ha-opencode)** - Home Assistant integration (required)

## Installation

### 1. Install the Plugin

```bash
# From npm (when published)
npm install --prefix ~/.config/opencode ha-opencode

# Or from local path
npm install --prefix ~/.config/opencode /path/to/opencode-homeassistant
```

### 2. Add to OpenCode Config

Add `"ha-opencode"` to the `plugins` array in `~/.config/opencode/opencode.json`:

```json
{
  "plugins": ["ha-opencode"]
}
```

### 3. Install the Home Assistant Integration

The plugin requires the companion Home Assistant integration. See [ha-opencode](https://github.com/stephengolub/ha-opencode) for installation instructions.

### 4. Pair with Home Assistant

1. In Home Assistant, go to Settings > Devices & Services
2. Add the "OpenCode" integration
3. A pairing code will be displayed (e.g., `ABC12DEF`)
4. In OpenCode, use the `ha_pair` tool with:
   - Your Home Assistant URL (e.g., `http://homeassistant.local:8123`)
   - A [long-lived access token](https://www.home-assistant.io/docs/authentication/#your-account-profile)
   - The pairing code

Once paired, the plugin will automatically reconnect on subsequent OpenCode sessions.

## Configuration

The plugin stores connection configuration in `~/.config/opencode/ha-config.json` after pairing:

```json
{
  "url": "ws://homeassistant.local:8123/api/websocket",
  "accessToken": "your-access-token",
  "instanceToken": "generated-during-pairing",
  "instanceId": "instance_abc123"
}
```

You can also set the Home Assistant URL and access token via environment variables:

```bash
export OPENCODE_HA_URL=http://homeassistant.local:8123
export OPENCODE_HA_ACCESS_TOKEN=your-access-token
```

## How It Works

```
┌─────────────────┐    WebSocket     ┌──────────────────┐
│                 │◄────────────────►│                  │
│    OpenCode     │                  │  Home Assistant  │
│    + Plugin     │                  │  + Integration   │
│                 │                  │                  │
└─────────────────┘                  └──────────────────┘
                                            │
                                            ▼
                                    ┌──────────────────┐
                                    │  Lovelace Card   │
                                    │  Mobile App      │
                                    │  Automations     │
                                    └──────────────────┘
```

1. **Plugin** connects to Home Assistant via WebSocket
2. **Session updates** are sent in real-time (state, model, tokens, cost, permissions)
3. **Commands** flow back from HA (send prompt, respond to permission, get history)
4. **Events** are fired in HA for automations (state changes, permission requests)

## Commands from Home Assistant

The plugin responds to these commands sent via the Home Assistant integration:

| Command | Description |
|---------|-------------|
| `send_prompt` | Send a text prompt to the current session |
| `respond_permission` | Approve (once/always) or reject a permission request |
| `get_history` | Retrieve session conversation history |
| `get_agents` | Get list of available agents |

## Session Data

Each OpenCode session reports the following to Home Assistant:

| Data | Description |
|------|-------------|
| `state` | Session state: `idle`, `working`, `waiting_permission`, `error` |
| `title` | Session/conversation title |
| `model` | AI model being used (e.g., `anthropic/claude-sonnet-4-20250514`) |
| `current_tool` | Currently executing tool |
| `tokens_input` | Total input tokens used |
| `tokens_output` | Total output tokens used |
| `cost` | Total session cost in USD |
| `last_activity` | Timestamp of last activity |
| `agent` | Primary agent selected |
| `current_agent` | Sub-agent currently executing |
| `hostname` | Machine hostname |
| `permission` | Pending permission details (if any) |

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Project Structure

```
src/
  index.ts        Plugin entry point
  websocket.ts    Home Assistant WebSocket client
  state.ts        Session state tracking
  commands.ts     Command handler (prompts, permissions, history)
  ha-config.ts    Configuration storage
  notify.ts       Terminal notifications (Kitty OSC 99)

tests/
  *.test.ts       Unit tests
```

## Troubleshooting

### Plugin not connecting

1. Verify the Home Assistant integration is installed and configured
2. Check that your access token is valid (test in Developer Tools > API)
3. Look for connection errors in OpenCode output
4. Try re-pairing: delete `~/.config/opencode/ha-config.json` and pair again

### Permission responses not working

1. Ensure the session is still active (not disconnected)
2. Check Home Assistant logs for errors
3. Verify the permission ID matches the pending permission

### Notifications not appearing

This plugin uses Kitty terminal notifications (OSC 99). Supported terminals:
- Kitty
- iTerm2 (with notifications enabled)

If your terminal doesn't support OSC 99, notifications will be silent.

## Documentation

Full documentation is available at **[stephengolub.github.io/opencode-homeassistant](https://stephengolub.github.io/opencode-homeassistant)**

- [Installation Guide](https://stephengolub.github.io/opencode-homeassistant/getting-started/installation/)
- [Configuration](https://stephengolub.github.io/opencode-homeassistant/getting-started/configuration/)
- [Pairing with Home Assistant](https://stephengolub.github.io/opencode-homeassistant/getting-started/pairing/)
- [Session Tracking](https://stephengolub.github.io/opencode-homeassistant/features/session-tracking/)
- [Commands](https://stephengolub.github.io/opencode-homeassistant/features/commands/)
- [Permissions](https://stephengolub.github.io/opencode-homeassistant/features/permissions/)

## Related Projects

- **[ha-opencode](https://github.com/stephengolub/ha-opencode)** - Home Assistant integration with Lovelace card and blueprints ([docs](https://stephengolub.github.io/ha-opencode))
- **[OpenCode](https://opencode.ai)** - AI coding assistant

## License

MIT
