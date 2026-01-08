# Pairing with Home Assistant

This guide explains how to connect the OpenCode plugin to your Home Assistant instance.

## Prerequisites

Before pairing, ensure you have:

1. The OpenCode plugin installed and enabled
2. The [ha-opencode integration](https://github.com/stephengolub/ha-opencode) installed in Home Assistant
3. A [long-lived access token](https://www.home-assistant.io/docs/authentication/#your-account-profile) from Home Assistant

## Creating an Access Token

1. Open Home Assistant
2. Click your profile name in the sidebar (bottom left)
3. Scroll down to "Long-Lived Access Tokens"
4. Click "Create Token"
5. Give it a name (e.g., "OpenCode")
6. Copy the token immediately - it won't be shown again!

## Pairing Process

### Step 1: Generate Pairing Code in Home Assistant

1. Go to **Settings > Devices & Services**
2. Click **Add Integration**
3. Search for "OpenCode"
4. A pairing code will be displayed (e.g., `ABC12DEF`)

The code is valid for 5 minutes.

### Step 2: Pair from OpenCode

In your OpenCode session, use the `ha_pair` tool:

```
Use ha_pair with:
- URL: http://homeassistant.local:8123
- Access Token: <your-token>
- Code: ABC12DEF
```

Replace the URL with your Home Assistant address. You can use:

- `http://homeassistant.local:8123` (mDNS)
- `http://192.168.1.100:8123` (IP address)
- `https://your-ha.duckdns.org` (external URL with SSL)

### Step 3: Verify Connection

On successful pairing:

1. Home Assistant will show the OpenCode instance as connected
2. The plugin will display a success notification
3. Session entities will appear in Home Assistant

## After Pairing

Once paired, the plugin will:

- **Automatically reconnect** when you start new OpenCode sessions
- **Persist connection** settings in `~/.config/opencode/ha-config.json`
- **Create entities** for each session in Home Assistant

## Troubleshooting

### "Invalid or expired pairing code"

- The code is only valid for 5 minutes
- Make sure you're using the correct code (case-insensitive)
- Generate a new code and try again

### "Connection refused"

- Verify your Home Assistant URL is correct
- Ensure Home Assistant is running and accessible
- Check for firewall rules blocking the connection

### "Invalid token"

- Make sure you copied the entire access token
- Verify the token hasn't been revoked
- Create a new token and try again

### "Integration not found"

- Ensure the [ha-opencode integration](https://github.com/stephengolub/ha-opencode) is installed
- Restart Home Assistant after installing the integration

## Re-pairing

If you need to re-pair (e.g., new Home Assistant instance, new token):

```bash
# Delete existing config
rm ~/.config/opencode/ha-config.json

# Restart OpenCode and pair again
```
