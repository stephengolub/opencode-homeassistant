# Card Installation

Install the OpenCode Card to get a beautiful dashboard for your OpenCode sessions.

## Method 1: HACS (Recommended)

!!! note "Coming Soon"
    HACS integration is planned for a future release.

1. Open HACS in Home Assistant
2. Go to "Frontend" section
3. Click the three dots menu → "Custom repositories"
4. Add: `https://gitlab.com/opencode-home-assistant/opencode-card`
5. Select category: "Lovelace"
6. Click "Add"
7. Search for "OpenCode Card" and install
8. Restart Home Assistant

## Method 2: Manual Installation

### Step 1: Download the Card

Download `opencode-card.js` from the [latest release](https://gitlab.com/opencode-home-assistant/opencode-card/-/releases).

Or use wget:

```bash
cd /path/to/homeassistant/config/www
wget https://gitlab.com/opencode-home-assistant/opencode-card/-/releases/permalink/latest/downloads/opencode-card.js
```

### Step 2: Add to Resources

=== "UI Method"

    1. Go to **Settings** → **Dashboards**
    2. Click the three dots menu → **Resources**
    3. Click **Add Resource**
    4. Enter URL: `/local/opencode-card.js`
    5. Select **JavaScript Module**
    6. Click **Create**

=== "YAML Method"

    Add to your `configuration.yaml`:
    
    ```yaml
    lovelace:
      resources:
        - url: /local/opencode-card.js
          type: module
    ```

### Step 3: Restart Home Assistant

Restart Home Assistant or reload resources for changes to take effect.

## Adding the Card

### UI Editor

1. Edit your dashboard
2. Click **Add Card**
3. Search for "OpenCode"
4. Select **OpenCode Card**

### YAML Configuration

```yaml
type: custom:opencode-card
title: My OpenCode Sessions
```

## Verifying Installation

1. Open your dashboard
2. The card should display "No OpenCode sessions found" if no sessions are active
3. Start OpenCode in a project - the session should appear automatically

## Troubleshooting

### Card Not Found

If you see "Custom element doesn't exist: opencode-card":

1. Clear your browser cache (Ctrl+Shift+R)
2. Verify the file exists at `config/www/opencode-card.js`
3. Check the resource URL is correct
4. Restart Home Assistant

### No Sessions Appearing

1. Verify the OpenCode plugin is running and connected to MQTT
2. Check MQTT integration is working in Home Assistant
3. Look for "OpenCode" devices in Settings → Devices

### Card Shows Error

Check the browser console (F12) for error messages. Common issues:

- MQTT not connected
- Incorrect topic configuration
- Missing entities
