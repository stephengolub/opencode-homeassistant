# OpenCode Home Assistant Plugin

Welcome to the documentation for the **OpenCode Home Assistant Plugin** - a seamless integration between [OpenCode](https://opencode.ai) AI coding assistant and Home Assistant via MQTT.

## What is this?

This plugin enables real-time monitoring and control of your OpenCode sessions directly from Home Assistant. Get notified when the AI needs permission to run commands, view session status, costs, and even send prompts - all from your Home Assistant dashboard.

## Features

- **Real-time Session Monitoring** - Track active OpenCode sessions with live state updates
- **Permission Management** - Approve or reject tool permissions from Home Assistant or mobile notifications
- **MQTT Discovery** - Automatic device registration in Home Assistant
- **Cost Tracking** - Monitor token usage and costs per session
- **Chat Interface** - Send prompts to OpenCode directly from Home Assistant (via companion card)
- **Multi-session Support** - Monitor multiple OpenCode instances across different projects

## Architecture Overview

```
┌─────────────────┐     MQTT      ┌──────────────────┐
│                 │◄─────────────►│                  │
│    OpenCode     │               │  Home Assistant  │
│    + Plugin     │               │  + MQTT Broker   │
│                 │               │                  │
└─────────────────┘               └──────────────────┘
                                          │
                                          ▼
                                  ┌──────────────────┐
                                  │  OpenCode Card   │
                                  │  (Lovelace UI)   │
                                  └──────────────────┘
```

## Quick Links

- [Installation Guide](getting-started/installation.md) - Get started in minutes
- [Configuration](getting-started/configuration.md) - Configure the plugin
- [Companion Card](card/overview.md) - Beautiful Lovelace card for session management
- [Blueprints](blueprints/overview.md) - Ready-to-use Home Assistant automations

## Requirements

- Home Assistant with MQTT integration configured
- OpenCode AI coding assistant
- Node.js 18+ (for the plugin)

## Support

- [GitLab Issues](https://gitlab.com/opencode-home-assistant/opencode-plugin/-/issues) - Report bugs or request features
- [GitLab Repository](https://gitlab.com/opencode-home-assistant/opencode-plugin) - Source code
