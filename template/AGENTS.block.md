<!-- harness-kit:start (managed block: `harness-kit init` rewrites everything between the markers) -->
## Workflow (harness-kit)

Sessions do not share memory; the `{{DIR}}/` folder does. These rules apply to every agent and every skill in this repository.

### Start of a session

1. Run `node {{DIR}}/.kit/kit.mjs status` (skip if a `<project-snapshot>` is already in your context) and read `{{DIR}}/STATE.md`.
2. Where they disagree, trust git history first, then `tasks.md`, then `STATE.md`. Fix the files before starting work.

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

- The active feature's folder name is the single line in `{{DIR}}/features/ACTIVE`.
- Start a feature with `node {{DIR}}/.kit/kit.mjs new <slug>`. It numbers the folder, copies the spec template, and sets `ACTIVE`.
- Templates are in `{{DIR}}/templates/`. Product documentation (README, user guides, API docs) is not a working document and stays where the project keeps it.

### While working

- One stage at a time: spec, plan, tasks, implement, verify. Do not write feature code before `spec.md` and `tasks.md` exist. The `flow` skill runs this sequence.
- Tick `- [x]` in `tasks.md` as each task lands and its check passes, never in a batch at the end.
- When you choose between real alternatives, or the user rules on something, append an entry to `{{DIR}}/DECISIONS.md`.

### End of a phase or a session

- Rewrite `{{DIR}}/STATE.md` (the `handoff` skill does this) and commit it together with the work it describes.
- A claim that something passes must come from a command run in this session. Otherwise list it under "Not verified".
<!-- harness-kit:end -->
