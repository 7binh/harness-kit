# {{DIR}}/

The working folder for people and AI agents on this project. Installed by [harness-kit](https://github.com/7binh/harness-kit).

| Path | Holds | Written by |
|---|---|---|
| `PROJECT.md` | Stack, commands, enforced rules, and the context map (what to read before editing each area) | `onboard` skill, then by hand |
| `STATE.md` | What is in flight, what is next, open questions | `handoff` skill, rewritten each time |
| `DECISIONS.md` | Append-only decision log | Anyone, when a decision is made |
| `ROADMAP.md` | Queue of future work: now, next, later, known debt | You; agents propose |
| `features/<NNN-slug>/` | One folder per feature: `spec.md`, `plan.md`, `tasks.md`, `research.md`, `review.md` | `flow` skill |
| `features/ACTIVE` | One line: the active feature, unless the branch name selects one | `kit.mjs new` / `use` |
| `notes/` | Documents not tied to a single feature | Anyone |
| `log/YYYY-MM.md` | Session log: who did what, in which tool, with which commits | `kit.mjs log` only |
| `templates/` | Starting points for spec, plan, and tasks. Edit them to fit the project | You |
| `.kit/kit.mjs` | The helper script. Overwritten on update; do not edit | harness-kit |
| `.kit/config.json` | Folder name, adapters, quality checks, stray-document rules | You and `onboard` |
| `.kit/events.jsonl` | Machine event log (session starts, blocked writes, check results). Local, not committed | harness-kit |

## Commands

```bash
node {{DIR}}/.kit/kit.mjs status           # where the project stands, and anything that drifted
node {{DIR}}/.kit/kit.mjs list             # every feature with its stage and task progress
node {{DIR}}/.kit/kit.mjs new <slug>       # start the next feature
node {{DIR}}/.kit/kit.mjs use <name>       # switch the active feature
node {{DIR}}/.kit/kit.mjs check            # run the quality checks from config.json
node {{DIR}}/.kit/kit.mjs log              # show the last session log entries
node {{DIR}}/.kit/kit.mjs doctor           # check the installation, find stray documents
```

## Skills

Ask your agent for these by name, or type them as a slash command where the tool supports it.

- `onboard`: study the codebase once and fill in `PROJECT.md` and the quality checks.
- `flow`: take a request through spec, plan, tasks, implement, verify, one stage at a time.
- `catchup`: rebuild context at the start of a session.
- `handoff`: save state and write the session log before stopping.

## Working in a team or on several features

- Name the branch after the feature (`003-trip-sharing` or `feat/003-trip-sharing`). The kit then selects that feature on that branch, so parallel branches and worktrees do not fight over `features/ACTIVE`.
- `STATE.md` describes the branch it is on. When two branches both changed it, keep the version from the branch being merged in, then run `handoff`.
- `DECISIONS.md` and `log/` are append-only, so merge conflicts there are resolved by keeping both sides.
