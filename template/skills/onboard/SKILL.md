---
name: onboard
description: Study the codebase and write the project knowledge file ({{DIR}}/PROJECT.md), the context map, and the quality checks that every later session relies on. Use right after harness-kit is installed, when PROJECT.md still says "(not filled in)", when the user says "onboard", "learn this project", "tìm hiểu dự án", or after a large restructuring made PROJECT.md wrong.
---

# Onboard

Goal: a new agent that reads only `AGENTS.md` and `{{DIR}}/PROJECT.md` knows how this project is built, how to check its own work, and what to read before editing each area. Write what you verified. Never fill a section from assumption.

## 1. Survey (read only)

1. Existing instructions: `AGENTS.md`, `CLAUDE.md`, `README*`, `CONTRIBUTING*`, anything under `docs/`, and tool rule folders (`.cursor/rules/`, `.claude/rules/`, `.github/copilot-instructions.md`). These outrank what you infer from code.
2. Manifests and build files (`package.json`, `*.csproj`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Makefile`, `Dockerfile`, CI workflows) for the stack, versions, and real commands.
3. The folder tree two or three levels deep. Skip dependencies and build output.
4. One representative slice of each major area, end to end, to see the pattern new code must copy.
5. Tests: where they live, how they are named, what they enforce (architecture tests, lint rules, type checks).
6. `git log -30 --oneline` for the commit message format and what is changing now.

In a large repository, survey area by area and use subagents or parallel searches if your tool has them.

## 2. Write `{{DIR}}/PROJECT.md`

Replace every "(not filled in)" section. Rules:

- **Commands** must be ones you ran or read in a manifest or CI file. Give the folder to run them from. Record traps you hit.
- **Rules that are enforced** names the file that defines each rule and what breaks it.
- **Conventions** lists only what the code does not make obvious.
- **Context map** has one row per area an agent might edit, pointing to the documents and the example files to read first. This table is the most valuable part: make it specific.
- **Do not touch** lists generated code, vendored code, secrets, and migrations already applied.
- Link to existing documents; do not copy them. Stay under about 120 lines.
- Write "not found" for anything you could not establish. Do not delete the heading.

If the project already documents some of this in `AGENTS.md` outside the harness-kit block, leave that text where it is and point to it from `PROJECT.md`.

## 3. Set the quality checks

Put the commands that prove a change is safe into `{{DIR}}/.kit/config.json` under `checks`, fastest first:

```json
"checks": [
  { "name": "typecheck", "command": "npm run typecheck" },
  { "name": "unit tests", "command": "npm test" }
]
```

Each command runs from the project root, so include any `cd`. Then run `node {{DIR}}/.kit/kit.mjs check` and report the real result. Leave out a command that cannot pass for reasons unrelated to the code (it needs a database or a secret), and note it in `PROJECT.md` under Commands.

## 4. Seed the rest

- `{{DIR}}/STATE.md`: if it is still the install placeholder, fill it from git history and any work in flight.
- `{{DIR}}/ROADMAP.md`: add items only when the repository states them (an issue list, a TODO document, a roadmap in the README). Do not invent a roadmap.
- `{{DIR}}/DECISIONS.md`: record decisions you found evidence for that a newcomer would otherwise undo, each with where you found it.
- Stray documents: run `node {{DIR}}/.kit/kit.mjs doctor`. If it lists specs or plans elsewhere, tell the user and offer the `git mv` it prints. Do not move them without a yes.

## 5. Report

In the user's language: what you wrote, the result of `check`, what you could not establish, and what you need the user to confirm or correct. Ask them to read the context map before trusting it.
