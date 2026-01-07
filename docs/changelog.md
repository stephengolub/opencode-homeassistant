# Changelog

All notable changes to the OpenCode Home Assistant Plugin will be documented here.

## [Unreleased]

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

### Features
- Real-time state updates via MQTT
- Multiple concurrent session support
- Configurable MQTT connection settings
- Environment variable support for credentials

---

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
