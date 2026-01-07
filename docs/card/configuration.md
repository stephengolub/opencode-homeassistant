# Card Configuration

The OpenCode Card supports several configuration options to customize its behavior.

## Basic Configuration

```yaml
type: custom:opencode-card
```

That's it! The card will automatically discover all OpenCode devices.

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | string | `"OpenCode Sessions"` | Card header title |
| `device` | string | - | Pin to a specific device ID |
| `working_refresh_interval` | number | `10` | Auto-refresh interval (seconds) when working |

## Examples

### Custom Title

```yaml
type: custom:opencode-card
title: AI Coding Assistants
```

### Pinned to Single Device

When you want a card dedicated to one project:

```yaml
type: custom:opencode-card
title: Main Project
device: abc123def456
```

To find your device ID:

1. Go to **Settings** → **Devices & Services** → **MQTT**
2. Click on your OpenCode device
3. The device ID is in the URL or device info

### Faster Refresh When Working

```yaml
type: custom:opencode-card
working_refresh_interval: 5
```

This refreshes the chat history every 5 seconds when the AI is actively working.

## View Modes

### List View (Default)

When multiple devices exist and no device is pinned, the card shows a list of all sessions.

Features:

- Sort toggle (activity/name)
- Click any session to see details
- Permission alerts shown inline

### Detail View

When a device is pinned or you click a session:

- Full session information
- Chat button
- Permission handling
- Token/cost statistics

### Chat View

Click the Chat button in detail view to open:

- Full conversation history
- Agent selector
- Message input
- Inline permission handling

## Multiple Cards

You can have multiple cards for different purposes:

```yaml
# Overview card - shows all sessions
- type: custom:opencode-card
  title: All Sessions

# Dedicated card for main project
- type: custom:opencode-card
  title: Main Project
  device: abc123def456
```

## Styling

The card automatically adapts to your Home Assistant theme, supporting:

- Light and dark modes
- Custom theme colors
- CSS variables for advanced customization

### Custom CSS (Advanced)

You can use card-mod for custom styling:

```yaml
type: custom:opencode-card
card_mod:
  style: |
    ha-card {
      border-radius: 16px;
    }
```
