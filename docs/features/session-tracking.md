# Session Tracking

The plugin tracks OpenCode sessions and reports their state to Home Assistant in real-time.

## Session Identity

Each OpenCode session is identified by a unique session ID (e.g., `ses_46b09b89bffevq6HeMNIkuvk4B`). This creates a corresponding device in Home Assistant with its own set of entities.

## Session Data

The following data is tracked and sent to Home Assistant:

| Data | Description |
|------|-------------|
| `state` | Current session state |
| `title` | Session/conversation title |
| `model` | AI model being used |
| `current_tool` | Currently executing tool |
| `tokens_input` | Total input tokens used |
| `tokens_output` | Total output tokens used |
| `cost` | Total session cost (USD) |
| `last_activity` | Timestamp of last activity |
| `agent` | Primary agent selected |
| `current_agent` | Sub-agent currently executing |
| `hostname` | Machine hostname |
| `permission` | Pending permission details |

## Session States

| State | Description |
|-------|-------------|
| `idle` | Session is idle, waiting for input |
| `working` | AI is actively processing |
| `waiting_permission` | Waiting for permission approval |
| `error` | An error occurred |

## Real-time Updates

Session data is pushed to Home Assistant immediately when:

- Session state changes
- AI model changes
- Token counts update
- A tool starts or finishes executing
- A permission request is created
- The session title is updated

## Multiple Sessions

You can have multiple OpenCode sessions running simultaneously. Each session:

- Gets its own device in Home Assistant
- Has independent entities
- Can be monitored and controlled separately

## Session Persistence

Sessions persist in Home Assistant as long as the OpenCode instance is connected. When OpenCode disconnects:

- Entities become "unavailable"
- Session data is retained
- On reconnection, entities come back online with current state

## Hostname Tracking

The plugin reports the hostname of the machine running OpenCode. This helps identify which machine a session is running on when you have multiple development environments.
