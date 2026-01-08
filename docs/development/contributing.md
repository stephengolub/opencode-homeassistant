# Contributing

We welcome contributions to the OpenCode Home Assistant Plugin! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 18+
- npm or pnpm
- Git

### Clone and Install

```bash
git clone https://github.com/stephengolub/opencode-homeassistant.git
cd opencode-homeassistant
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
opencode-homeassistant/
├── src/
│   ├── index.ts        # Plugin entry point
│   ├── websocket.ts    # Home Assistant WebSocket client
│   ├── state.ts        # State tracking
│   ├── commands.ts     # Command handling
│   ├── ha-config.ts    # Configuration storage
│   └── notify.ts       # Local notifications
├── tests/              # Test files
├── docs/               # Documentation (MkDocs)
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
- Mock external dependencies (WebSocket, OpenCode SDK)
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

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit with a descriptive message
6. Push and create a Pull Request

### Commit Messages

Follow conventional commits:

```
feat: add new command for session switching
fix: handle WebSocket reconnection edge case
docs: update installation guide
test: add tests for permission handling
chore: update dependencies
```

### PR Guidelines

- Keep changes focused and atomic
- Include tests for new functionality
- Update documentation if needed
- Ensure CI passes

## Documentation

Documentation is built with MkDocs and hosted on GitHub Pages.

### Local Preview

```bash
pip install -r docs/requirements.txt
mkdocs serve
```

Open http://localhost:8000

### Building Docs

```bash
mkdocs build
```

## Releasing

Releases are automated via GitHub Actions:

1. Update version in `package.json`
2. Create a tag: `git tag v1.2.3`
3. Push the tag: `git push origin v1.2.3`

CI will:

- Run tests
- Build the package
- Create GitHub release

## Related Projects

- **[ha-opencode](https://github.com/stephengolub/ha-opencode)** - Home Assistant integration (companion project)
- **[OpenCode](https://opencode.ai)** - AI coding assistant

## Getting Help

- [GitHub Issues](https://github.com/stephengolub/opencode-homeassistant/issues)

## License

MIT License - see [LICENSE](https://github.com/stephengolub/opencode-homeassistant/blob/main/LICENSE) for details.
