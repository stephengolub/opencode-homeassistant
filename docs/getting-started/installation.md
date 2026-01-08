# Installation

This guide walks you through installing the OpenCode Home Assistant plugin.

## Prerequisites

Before installing the plugin, ensure you have:

1. **OpenCode** installed and working
2. **Home Assistant** running (2024.1 or later)
3. **ha-opencode integration** installed in Home Assistant - see [ha-opencode](https://github.com/stephengolub/ha-opencode)

## Install the Plugin

### Option 1: From npm (Recommended)

```bash
npm install --prefix ~/.config/opencode ha-opencode
```

### Option 2: From Local Path

If you've cloned the repository:

```bash
npm install --prefix ~/.config/opencode /path/to/opencode-homeassistant
```

### Option 3: From GitHub

```bash
npm install --prefix ~/.config/opencode github:stephengolub/opencode-homeassistant
```

## Enable the Plugin

Add `"ha-opencode"` to your OpenCode configuration file (`~/.config/opencode/opencode.json`):

```json
{
  "plugins": ["ha-opencode"]
}
```

If you have other plugins, add it to the existing array:

```json
{
  "plugins": ["some-other-plugin", "ha-opencode"]
}
```

## Verify Installation

Start a new OpenCode session. You should see a notification that the plugin is loaded (if your terminal supports notifications).

## Next Steps

1. [Configure the plugin](configuration.md) (optional)
2. [Pair with Home Assistant](pairing.md)
