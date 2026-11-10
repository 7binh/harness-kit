# Changelog

## 0.2.1

- Fix: the write guard let stray documents through when the project was reached through a symlinked path (for example macOS `/var` → `/private/var`).
- Fix: `npm test` on Node 22.

## 0.2.0

Additions for large projects.

- **Project knowledge**: `PROJECT.md` (stack, commands, enforced rules, context map) and the `onboard` skill that fills it from the codebase.
- **Session log**: `kit.mjs log` appends an entry to `log/YYYY-MM.md` with the time, branch, feature, stage, tool, and the commits since the previous entry. `handoff` calls it.
- **Event log**: `.kit/events.jsonl` records session starts, feature switches, check results, and blocked writes and commits. Local and git-ignored.
- **Quality gates**: `checks` in `config.json` and `kit.mjs check`.
- **Parallel work**: a branch named after a feature selects it; new `use` and `list` commands.
- **Roadmap**: `ROADMAP.md` (now, next, later, known debt); `flow` takes the next item from it.
- **Git pre-commit check**: `init --git-hook` rejects commits that add workflow documents outside the workflow folder, in every tool.
- `CLAUDE.md` and `GEMINI.md` now get a managed block importing `AGENTS.md`, `PROJECT.md`, and `STATE.md`.
- `doctor` reports setup still to do without failing a fresh install.

Updating from 0.1.0: run `npx github:7binh/harness-kit init` again. Nothing you wrote is overwritten.

## 0.1.0

First release: installer, `AGENTS.md` block, `STATE.md`, `DECISIONS.md`, feature folders, the `flow`, `catchup`, and `handoff` skills, and Claude Code hooks.
