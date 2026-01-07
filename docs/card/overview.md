# OpenCode Card

The OpenCode Card is a custom Lovelace card for Home Assistant that provides a beautiful interface for monitoring and controlling your OpenCode sessions.

## Features

- **Session List View** - See all active OpenCode sessions at a glance
- **Detailed View** - Dive into individual sessions for full details
- **Permission Handling** - Approve or reject permissions with one tap
- **Chat Interface** - Send prompts directly from the card
- **Agent Selection** - Choose which agent handles your prompts
- **Real-time Updates** - Live status, costs, and token tracking
- **Dark/Light Mode** - Adapts to your Home Assistant theme
- **Sorting** - Sort sessions by activity or name

## Screenshots

### Session List

The list view shows all your OpenCode sessions with:

- Current state with color-coded indicator
- Project name
- Session title
- Model in use
- Current tool (when working)
- Cost and token usage
- Last activity time

### Detail View

Click a session to see:

- Full state with pulse animation when working
- Session title and model
- Active agent information
- Token statistics
- Permission alerts (if pending)
- Chat button to open the conversation

### Chat Interface

The chat modal provides:

- Full conversation history
- Lazy loading for long conversations
- Agent selector dropdown
- Real-time message updates
- Inline permission handling
- Auto-refresh when working

## Repository

The card is maintained in a separate repository:

- [GitLab: opencode-home-assistant/opencode-card](https://gitlab.com/opencode-home-assistant/opencode-card)

## Next Steps

- [Installation Guide](installation.md)
- [Configuration Options](configuration.md)
