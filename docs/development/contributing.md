# Contributing

We welcome contributions to the OpenCode Home Assistant Plugin! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 18+
- npm or pnpm
- Git

### Clone and Install

```bash
git clone https://gitlab.com/opencode-home-assistant/opencode-plugin.git
cd opencode-plugin
npm install
```

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Project Structure

```
opencode-plugin/
├── src/
│   ├── index.ts        # Plugin entry point
│   ├── mqtt.ts         # MQTT client wrapper
│   ├── discovery.ts    # HA MQTT Discovery
│   ├── state.ts        # State tracking
│   ├── commands.ts     # Command handling
│   ├── config.ts       # Configuration
│   ├── notify.ts       # Local notifications
│   └── cleanup.ts      # Session cleanup
├── tests/              # Test files
├── blueprints/         # HA blueprints
├── docs/               # Documentation
├── dist/               # Build output
└── coverage/           # Test coverage
```

## Code Style

- TypeScript with strict mode
- ESM modules
- Comprehensive type definitions
- JSDoc comments for public APIs

## Testing

We use [Vitest](https://vitest.dev/) for testing. Tests should:

- Cover all public APIs
- Mock external dependencies (MQTT, OpenCode SDK)
- Test error conditions
- Maintain >80% coverage

### Running Specific Tests

```bash
# Run a specific test file
npm test -- tests/commands.test.ts

# Run tests matching a pattern
npm test -- -t "permission"
```

## Submitting Changes

### Merge Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit with a descriptive message
6. Push and create a Merge Request

### Commit Messages

Follow conventional commits:

```
feat: add new command for session switching
fix: handle MQTT reconnection edge case
docs: update installation guide
test: add tests for permission handling
chore: update dependencies
```

### MR Guidelines

- Keep changes focused and atomic
- Include tests for new functionality
- Update documentation if needed
- Ensure CI passes

## Documentation

Documentation is built with MkDocs and hosted on GitLab Pages.

### Local Preview

```bash
pip install mkdocs-material mike
mkdocs serve
```

Open http://localhost:8000

### Building Docs

```bash
mkdocs build
```

## Releasing

Releases are automated via GitLab CI:

1. Update version in `package.json`
2. Create a tag: `git tag v1.2.3`
3. Push the tag: `git push origin v1.2.3`

CI will:

- Run tests
- Build the package
- Publish to npm
- Create GitLab release
- Update documentation

## Getting Help

- [GitLab Issues](https://gitlab.com/opencode-home-assistant/opencode-plugin/-/issues)
- [Discussions](https://gitlab.com/opencode-home-assistant/opencode-plugin/-/issues)

## License

MIT License - see [LICENSE](https://gitlab.com/opencode-home-assistant/opencode-plugin/-/blob/main/LICENSE) for details.
