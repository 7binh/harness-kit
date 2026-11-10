---
name: flow
description: Take a feature request from idea to verified code, one stage at a time (spec, plan, tasks, implement, verify), writing every document into {{DIR}}/features/. Use when the user describes a feature or change to build, asks for a spec, plan, or task list, says "next step" or "tiếp tục", or when another skill is about to write a spec or plan document.
---

# Flow

You are the router for this project's workflow. You decide which stage the work is in, run that one stage, and make sure its document lands in `{{DIR}}/`. Reply to the user in their language; keep file names and commands as written.

## 1. Find the stage

Run `node {{DIR}}/.kit/kit.mjs status`. It prints the active feature and its stage.

- The user describes something new, or there is no active feature: run `node {{DIR}}/.kit/kit.mjs new <short-slug>`, then start at **spec**.
- Otherwise continue the active feature at the stage the status reports.

| Stage | Entered when | Produces | Leaves when |
|---|---|---|---|
| spec | no `spec.md`, or it says `Status: draft`, or it still holds `[NEEDS CLARIFICATION` | `spec.md` | the user approves it: no clarification marker remains and you set `Status: approved` |
| plan | `spec.md` approved, no `plan.md` | `plan.md`, optionally `research.md` | the user approves it |
| tasks | `plan.md` exists, no `tasks.md` | `tasks.md` | every plan change maps to a task |
| implement | `tasks.md` has `- [ ]` items | code, ticked tasks | no `- [ ]` remains |
| verify | all tasks ticked, no `review.md` | `review.md` | checks pass, or failures are recorded |

All paths are inside `{{DIR}}/features/<active>/`. Start each document from `{{DIR}}/templates/` when a template exists.

## 2. Run one stage

Run exactly one stage, then stop and report, so the user can review the document before the next stage builds on it. Run several stages in a row only when the user says so ("chạy hết", "do it all", "don't ask"); even then, stop for unanswered clarification questions and for failing checks.

**Use the best skill available for the stage, and keep the output here.** If a more specialised skill is installed, use its method for the stage:

| Stage | Skills to prefer when present |
|---|---|
| spec | brainstorming, speckit-specify, speckit-clarify, grilling |
| plan | writing-plans, speckit-plan, research, codebase-design |
| tasks | speckit-tasks, speckit-analyze |
| implement | tdd, test-driven-development, executing-plans, speckit-implement |
| verify | code-review, verification-before-completion, speckit-converge |

Those skills name their own output folders (`specs/`, `docs/plans/`, `docs/superpowers/` and others). That part of their instructions does not apply in this repository:

- Write the document to the path in the table above.
- Skip their scaffolding steps that create a feature folder or a branch somewhere else; `kit.mjs new` has done that job.
- If a script has already written a document elsewhere, move it into the feature folder and delete the stray copy.

With no specialised skill, work from the template and the stage notes below.

## 3. Stage notes

- **spec**: describe user-visible behaviour and how each story is accepted. No implementation detail. Ask the user at most five questions, the ones whose answers change the design; record anything still open as `[NEEDS CLARIFICATION: ...]`.
- **plan**: read the code the feature touches before writing. Name real files. Check the plan against the project rules in `AGENTS.md` and list every exception with its reason.
- **tasks**: each task is one reviewable change with its file path. Order by dependency, group into phases that each leave something usable, and end with a verification phase.
- **implement**: take tasks in order. After each one, run its check, then tick it. If a task turns out wrong or missing, fix `tasks.md` first, then the code.
- **verify**: run the checks from `plan.md`. Write `review.md` with each command, its result, and anything not checked. A failing check goes back to **implement** as a new task.

## 4. Report

End every invocation with:

1. What was written, with its path.
2. What the user needs to review or answer.
3. The next stage, and that asking for `flow` again continues it.

When a stage completes a phase of work, also update `{{DIR}}/STATE.md` (see the `handoff` skill) so the next session starts from the right place.
