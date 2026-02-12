# Echo (Electron Refactor)

Echo is now refactored into an Electron architecture with explicit `main / preload / renderer` boundaries.

## What is implemented

- Global shortcut registration (`Command+K` by default)
- Overlay window near cursor with remembered window position
- Dashboard window with `Home / History / Commands / Settings`
- Codex runtime via persistent `codex app-server` JSON-RPC session
- Streaming output, cancel flow, timeout/reset handling
- Slash command normalization and prompt interpolation (`{{input}}`)
- History retention policy and token summary
- Secure preload bridge (`contextIsolation: true`, `nodeIntegration: false`)

## Project structure

- `src/main`: system integration and Electron services
- `src/preload`: IPC whitelist API exposed to renderer
- `src/renderer`: overlay + dashboard UI
- `src/shared`: shared domain logic and IPC contracts
- `Tests/unit`: unit tests for core domain rules

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Unified local entry

Use:

```bash
./scripts/dev-local.sh
```

Behavior:

- If `package.json` with `scripts.dev` exists: runs Electron dev mode.
- Otherwise: falls back to Swift `./scripts/dev.sh`.

## Legacy Swift POC

The original Swift POC code remains in `Sources/` and `Tests/EchoTests/` for migration reference during transition.
