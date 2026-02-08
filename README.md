# Echo POC

Minimal macOS POC for:

- Global `Cmd+K` hotkey
- Inline floating panel near mouse position
- Prompt input + local CLI execution
- Output preview + `Cmd+Enter` accept (copies output to clipboard)

## Run

```bash
swift run
```

## Dev Mode

Use file-watch mode to auto build and relaunch on every Swift change:

```bash
./scripts/dev.sh
```

This watches `Sources/**/*.swift` and `Package.swift`, rebuilds, then restarts the app automatically.

## Current behavior

- Press `Cmd+K` from any app to toggle panel.
- Type a prompt.
- Press `Enter` to run Codex (`codex exec`).
- If text is selected in the active app when the panel opens, `Run` includes that selected text as context.
- Use the mode menu (`Edit Selection` / `Ask Question`) to choose rewrite vs Q&A behavior.
- While running, click `Stop` (or press `Esc`) to cancel the in-flight request.
- Press `Cmd+Enter` to accept (copies output to clipboard).
- Press `Esc` to close.

## Prerequisites

- Install Codex CLI and ensure `codex` is available in `PATH`.
- Complete login first (`codex login`), otherwise Run will fail.
- Enable Accessibility permission for Echo so selected text can be read across apps.

The runner invokes:

```bash
codex exec --skip-git-repo-check --color never --output-last-message <tmpfile> -
```
