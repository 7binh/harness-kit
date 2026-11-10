# {{DIR}}/

The working folder for people and AI agents on this project. Installed by [harness-kit](https://github.com/7binh/harness-kit).

| Path | Holds |
|---|---|
| `STATE.md` | What is in flight, what is next, open questions. Rewritten at each handoff. |
| `DECISIONS.md` | Append-only decision log. |
| `features/<NNN-slug>/` | One folder per feature: `spec.md`, `plan.md`, `tasks.md`, `research.md`, `review.md`. |
| `features/ACTIVE` | One line: the folder name of the feature being worked on. |
| `notes/` | Documents not tied to a single feature. |
| `templates/` | Starting points for spec, plan, and tasks. Edit them to fit the project. |
| `.kit/` | The helper script and its config. Overwritten on update; do not edit `kit.mjs`. |

## Commands

```bash
node {{DIR}}/.kit/kit.mjs status       # where the project stands, and anything that drifted
node {{DIR}}/.kit/kit.mjs new <slug>   # start the next feature
node {{DIR}}/.kit/kit.mjs doctor       # check the installation, find stray documents
```

## Skills

Ask your agent for these by name, or type them as a slash command where the tool supports it.

- `flow`: take a request through spec, plan, tasks, implement, verify, one stage at a time.
- `catchup`: rebuild context at the start of a session.
- `handoff`: save state before stopping.
