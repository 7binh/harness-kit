<!-- harness-kit:start (managed block: `harness-kit init` rewrites everything between the markers) -->
## Workflow (harness-kit)

Sessions do not share memory; the `{{DIR}}/` folder does. These rules apply to every agent and every skill in this repository.

### Start of a session

1. Run `node {{DIR}}/.kit/kit.mjs status` (skip if a `<project-snapshot>` is already in your context).
2. Read `{{DIR}}/STATE.md` and `{{DIR}}/PROJECT.md`.
3. Where the sources disagree, trust git history first, then `tasks.md`, then `STATE.md`. Fix the files before starting work.

### Before you edit code

Find the area you are about to change in the context map in `{{DIR}}/PROJECT.md` and read what it lists. If the area is missing from the map, read a neighbouring example first, then add the row.

### Where documents go

Every working document is written inside `{{DIR}}/`. This overrides the default output path of any skill, command, plugin, or template you are following: use that skill's method, write the result here.

| Document | Path |
|---|---|
| Requirements, brainstorm, design, PRD, spec | `{{DIR}}/features/<NNN-slug>/spec.md` |
| Implementation plan, technical design | `{{DIR}}/features/<NNN-slug>/plan.md` |
| Task list with checkboxes | `{{DIR}}/features/<NNN-slug>/tasks.md` |
| Research, investigation, notes for a feature | `{{DIR}}/features/<NNN-slug>/research.md` |
| Review, test, or verification report | `{{DIR}}/features/<NNN-slug>/review.md` |
| Anything not tied to one feature | `{{DIR}}/notes/<slug>.md` |
| What is in flight and what is next | `{{DIR}}/STATE.md` |
| Decisions the code cannot explain | `{{DIR}}/DECISIONS.md` (append only) |
| Stack, commands, rules, context map | `{{DIR}}/PROJECT.md` |
| Queue of future work | `{{DIR}}/ROADMAP.md` |
| Session log | `{{DIR}}/log/` (written by `kit.mjs log`, never by hand) |

- The active feature is the one named by the branch (`003-foo` or `feat/003-foo`), otherwise the line in `{{DIR}}/features/ACTIVE`.
- Start a feature with `node {{DIR}}/.kit/kit.mjs new <slug>`; switch with `use <name>`; see all of them with `list`.
- Product documentation (README, user guides, API docs) is not a working document and stays where the project keeps it.

### While working

- One stage at a time: spec, plan, tasks, implement, verify. Do not write feature code before `spec.md` and `tasks.md` exist. The `flow` skill runs this sequence. A fix of a few lines needs no feature folder.
- Tick `- [x]` in `tasks.md` as each task lands and its check passes, never in a batch at the end.
- When you choose between real alternatives, or the user rules on something, append an entry to `{{DIR}}/DECISIONS.md`.
- `node {{DIR}}/.kit/kit.mjs check` runs the project's quality checks. Run it before you call a phase done.

### End of a phase or a session

- Run the `handoff` skill: it rewrites `{{DIR}}/STATE.md` and adds a session log entry. Commit `{{DIR}}/` together with the work it describes.
- A claim that something passes must come from a command run in this session. Otherwise list it under "Not verified".
<!-- harness-kit:end -->
