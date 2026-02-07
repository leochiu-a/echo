# Agent Rules

## Commitlint

- All commit messages must pass Conventional Commits format.
- Required format: `<type>(<scope>): <subject>` or `<type>: <subject>`.
- Allowed `type`: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Keep subject in lowercase, imperative mood, and without a trailing period.
- Before finalizing a commit, run commitlint and fix the message if it fails.
