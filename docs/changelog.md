# Changelog

All notable changes to the OpenCode Home Assistant Plugin will be documented here.

## [Unreleased]

### Changed
- **BREAKING**: Replaced MQTT with native WebSocket connection to Home Assistant
- Commands renamed to match Home Assistant integration: `prompt` → `send_prompt`, `permission_response` → `respond_permission`
- Removed `get_history_since` command - use `get_history` with optional `since` parameter
- Moved blueprints to [ha-opencode](https://github.com/stephengolub/ha-opencode) repository

### Added
- Secure pairing flow with one-time codes
- Token-based authentication for persistent connections
- Automatic reconnection with saved credentials
- History and agents response handlers

### Removed
- MQTT broker dependency
- MQTT Discovery
- Stale session cleanup (handled by HA integration)
- Blueprints (now in ha-opencode repo)

## [0.1.3] - 2025-01-07

### Fixed
- Blueprint now correctly reads `previous_state` attribute by adding delay for HA to process MQTT attributes
- Fixed `previous_state` returning null instead of triggering default value (use `or` instead of `| default()`)
- Variables are now set after delay to ensure fresh entity state is read

## [0.1.2] - 2025-01-07

### Fixed
- Session resumption now properly updates Home Assistant dashboard
- Plugin re-initializes when switching to a different session, ensuring entities reflect the current session state
- Previous session is marked unavailable before switching to a new session

## [0.1.1] - 2025-01-07

### Added
- MkDocs documentation with versioning support
- GitLab Pages deployment for documentation

## [0.1.0] - 2025-01-07

### Added
- Initial release
- MQTT integration with Home Assistant
- Automatic device discovery via MQTT Discovery
- Session state tracking (idle, working, waiting_permission, error)
- Permission management with approve/reject/always responses
- Token and cost tracking
- Chat history retrieval via MQTT commands
- Agent listing and selection
- Home Assistant blueprints for notifications
- Session cleanup functionality
- Local terminal notifications (Kitty protocol)
- Comprehensive test suite

---

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
