# OpenCode Home Assistant Plugin

Welcome to the documentation for the **OpenCode Home Assistant Plugin** - a seamless integration between [OpenCode](https://opencode.ai) AI coding assistant and Home Assistant via native WebSocket connection.

## What is this?

This plugin enables real-time monitoring and control of your OpenCode sessions directly from Home Assistant. Get notified when the AI needs permission to run commands, view session status, costs, and even send prompts - all from your Home Assistant dashboard or mobile app.

## Features

- **Native WebSocket Connection** - Direct connection to Home Assistant, no MQTT broker required
- **Secure Pairing** - Simple one-time pairing flow with token-based authentication
- **Real-time Session Monitoring** - Track active OpenCode sessions with live state updates
- **Permission Management** - Approve or reject tool permissions from Home Assistant or mobile notifications
- **Cost Tracking** - Monitor token usage and costs per session
- **Chat Interface** - Send prompts to OpenCode directly from Home Assistant (via companion integration)
- **Multi-session Support** - Monitor multiple OpenCode instances across different projects

## Architecture Overview

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

## Quick Links

- [Installation Guide](getting-started/installation.md) - Get started in minutes
- [Configuration](getting-started/configuration.md) - Configure the plugin
- [Pairing with Home Assistant](getting-started/pairing.md) - Connect to your Home Assistant instance

## Requirements

- [OpenCode](https://opencode.ai) AI coding assistant
- [Home Assistant](https://www.home-assistant.io/) 2024.1 or later
- **[ha-opencode](https://github.com/stephengolub/ha-opencode)** - Companion Home Assistant integration (required)

## Support

- [GitHub Issues](https://github.com/stephengolub/opencode-homeassistant/issues) - Report bugs or request features
- [GitHub Repository](https://github.com/stephengolub/opencode-homeassistant) - Source code
