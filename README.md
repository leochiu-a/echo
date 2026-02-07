# Echo Copilot POC

Minimal macOS POC for:

- Global `Cmd+K` hotkey
- Inline floating panel near mouse position
- Prompt input + local CLI execution
- Output preview + `Cmd+Enter` accept (copies output to clipboard)

## Run

```bash
swift run
```

## Current behavior

- Press `Cmd+K` from any app to toggle panel.
- Type a prompt.
- Press `Enter` to run.
- Press `Cmd+Enter` to accept (copies output to clipboard).
- Press `Esc` to close.

The CLI runner is currently wired to `/bin/echo` as a safe placeholder.
Next step is replacing it with your actual allowlisted CLI contract.
