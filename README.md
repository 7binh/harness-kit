# harness-kit

One workflow folder and one set of rules for every AI coding agent.

[Tiếng Việt](README.vi.md)

AI coding sessions start with no memory, and each tool, skill, and plugin writes its specs and plans to a different place. On a large project that turns into lost context, repeated mistakes, and documents scattered across five folders. harness-kit gives a project:

- **Memory that lives in the repository**: project knowledge, current state, decisions, and a session log that every session reads first and updates last.
- **One home for working documents**: specs, plans, task lists, research, and reviews all go in `workflow/features/<NNN-slug>/`, whichever skill produced them.
- **Four skills that run the loop**: `onboard`, `flow`, `catchup`, `handoff`.
- **Quality gates in one place**: the commands that prove a change is safe, run with one command.
- **The same behaviour across tools**: the rules sit in `AGENTS.md`, which Claude Code, Codex, Cursor, Antigravity, OpenCode, and Gemini CLI all read.

## Install

Run this in the root of your project. It needs Node.js 18 or newer, and git.

```bash
npx github:7binh/harness-kit init
```

Or with a one-line script:

```bash
curl -fsSL https://raw.githubusercontent.com/7binh/harness-kit/main/install.sh | sh
```

```powershell
irm https://raw.githubusercontent.com/7binh/harness-kit/main/install.ps1 | iex
```

| Option | Meaning | Default |
|---|---|---|
| `--dir <path>` | The workflow folder, relative to the project root | `workflow` |
| `--agents <list>` | Extra adapters: `claude`, `gemini`, `all`, `none` | `all` |
| `--git-hook` | Add a git pre-commit check that rejects stray workflow documents | off |
| `--force` | Also overwrite the files you own (state, decisions, project, roadmap, templates) | off |

Running `init` again updates the kit. It replaces only its own blocks in `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`, its own hooks, its skills, and `.kit/kit.mjs`. Your documents, your config values, and everything else in those files stay as they are.

Then:

1. Open your agent and ask for **`onboard`**. It studies the codebase and fills in `workflow/PROJECT.md`, the context map, and the quality checks. Review what it wrote.
2. Commit `AGENTS.md` and `workflow/` so the memory travels with the repository.

## What gets installed

```text
AGENTS.md                     a managed block with the workflow rules (the rest of the file is yours)
CLAUDE.md, GEMINI.md          a managed block importing AGENTS.md, PROJECT.md, and STATE.md
workflow/
  PROJECT.md                  stack, commands, enforced rules, context map
  STATE.md                    what is in flight, what is next, open questions
  DECISIONS.md                append-only decision log
  ROADMAP.md                  now, next, later, known debt
  features/
    ACTIVE                    the active feature (a branch named after a feature overrides it)
    001-some-feature/         spec.md, plan.md, tasks.md, research.md, review.md
  notes/                      documents not tied to one feature
  log/2026-11.md              session log, one file per month
  templates/                  spec, plan, and tasks templates (edit them to fit)
  .kit/kit.mjs                helper script, no dependencies
  .kit/config.json            folder name, adapters, quality checks, stray-document rules
  .kit/events.jsonl           machine event log (local, git-ignored)
.agents/skills/               onboard, flow, catchup, handoff
.claude/skills/               the same four, for Claude Code
.claude/settings.json         two hooks, merged into your existing settings
```

## Daily loop

1. **Open a session.** The agent runs `status` and reads `STATE.md` and `PROJECT.md`. Ask for `catchup` after a gap.
2. **Describe a feature and ask for `flow`.** It creates `workflow/features/NNN-slug/` and runs one stage at a time: spec, plan, tasks, implement, verify. You review each document before the next stage builds on it.
3. **Stop for the day.** Ask for `handoff`. It ticks the finished tasks, logs decisions, rewrites `STATE.md`, and adds a session log entry.

In tools with slash commands for skills, these are `/onboard`, `/flow`, `/catchup`, and `/handoff`. Elsewhere, ask in words: "run the flow skill".

### Commands

```bash
node workflow/.kit/kit.mjs status        # branch, last commits, active feature, stage, drift warnings
node workflow/.kit/kit.mjs list          # every feature with its stage and task progress
node workflow/.kit/kit.mjs new <slug>    # create the next numbered feature and make it active
node workflow/.kit/kit.mjs use <name>    # switch the active feature
node workflow/.kit/kit.mjs check         # run the quality checks
node workflow/.kit/kit.mjs log           # show recent session log entries
node workflow/.kit/kit.mjs doctor        # check the installation, list stray documents
```

`npx github:7binh/harness-kit <command>` does the same from the project root.

## Built for large projects

**Three tiers of context.** Loading everything into every session does not scale, so the kit splits it:

| Tier | Loaded | Content |
|---|---|---|
| Always | Every session | `AGENTS.md`, `PROJECT.md`, `STATE.md`, and the live snapshot |
| By area | Before editing that area | The documents the context map in `PROJECT.md` lists for it |
| By feature | While working on it | `spec.md`, `plan.md`, `tasks.md` of the active feature |

**Project knowledge.** `onboard` reads the manifests, CI files, tests, and one slice of each area, then writes down the real commands, the rules a tool enforces, and the context map. Sections it could not establish are marked, not guessed.

**Quality gates.** `checks` in `config.json` lists the commands that prove a change is safe. `kit.mjs check` runs them all, prints the tail of any failure, and exits non-zero, so the same command works for agents, people, and CI:

```json
"checks": [
  { "name": "typecheck", "command": "npm run typecheck" },
  { "name": "unit tests", "command": "npm test" }
]
```

**Parallel work.** A branch named `003-foo` or `feat/003-foo` selects feature `003-foo` on that branch, so several people, branches, or worktrees can each have their own active feature. `list` shows all of them.

**Two logs.**

- `workflow/log/YYYY-MM.md` is the session log, committed with the code. Each `handoff` adds an entry with the time, branch, feature, stage, the tool that did the work, and the commits since the previous entry, which the script reads from git.
- `workflow/.kit/events.jsonl` is a local machine log: session starts, feature switches, check results, and every blocked write or commit. Use it to see how often the guard fires and which checks fail.

**Roadmap and debt.** `ROADMAP.md` holds the queue beyond the active feature. `flow` takes the next item from it when you ask for "the next thing".

## How documents stay in one place

Four layers, from soft to hard:

1. **A rule in `AGENTS.md`.** A table maps each kind of document to its path and states that this overrides any skill's default output folder.
2. **The `flow` skill.** It uses the best skill installed for each stage (Spec Kit, Superpowers, your own) for its method, and writes the result into the feature folder.
3. **A guard hook (Claude Code).** Creating `spec.md`, `plan.md`, `tasks.md`, `research.md`, or `prd.md` outside the workflow folder, or any new markdown file under `specs/`, `plans/`, `docs/specs/`, `docs/plans/`, `docs/superpowers/`, is rejected with a message naming the right path. Editing files that already exist is never blocked.
4. **A git pre-commit check (every tool, opt-in with `--git-hook`).** A commit that adds such a file is rejected. It runs whichever agent, or person, made the commit.

`status` and `doctor` also report stray documents. Edit `strayDirs` and `artifactNames` in `config.json` to change what counts as stray.

## Tool support

| Tool | Reads the rules from | Reads skills from | Automatic hooks |
|---|---|---|---|
| Claude Code | `CLAUDE.md` → `AGENTS.md` | `.claude/skills/` | Snapshot at session start, guard on writes |
| Codex | `AGENTS.md` | `.agents/skills/` | None |
| Cursor | `AGENTS.md` | `.agents/skills/` | None |
| Antigravity | `AGENTS.md` | `.agents/skills/` | None |
| OpenCode | `AGENTS.md` | `.agents/skills/` | None |
| Gemini CLI | `GEMINI.md` → `AGENTS.md` | `.agents/skills/` | None |
| Others (Copilot, Windsurf, ...) | `AGENTS.md` where supported | varies | None |

Without hooks, the agent follows the "Start of a session" rule in `AGENTS.md` and runs the status command itself. That depends on the model obeying its instructions. The git pre-commit check does not, so turn it on if you use these tools.

Notes:

- OpenCode also scans `.claude/skills/`, so with the Claude adapter installed it sees each skill twice. The copies are identical. Use `--agents gemini` or `--agents none` if you do not use Claude Code.
- Some Cursor versions have been reported not to list skills from `.agents/skills/`. If yours does not, copy the skill folders into `.cursor/skills/`.
- The hooks run `node workflow/.kit/kit.mjs` relative to the folder where the session started. Start your agent from the project root.

## Use in CI

```yaml
- run: node workflow/.kit/kit.mjs doctor   # fails when workflow documents sit outside workflow/
- run: node workflow/.kit/kit.mjs check    # fails when a quality check fails
```

## Adopting an existing project

`init` never moves your files. If you already have specs elsewhere, `doctor` lists them and prints the command to adopt them, for example:

```bash
git mv specs/003-trip-sharing workflow/features/003-trip-sharing
```

## Uninstall

```bash
npx github:7binh/harness-kit uninstall          # lists what it would do; changes nothing
npx github:7binh/harness-kit uninstall --yes    # does it
```

It returns the project to how it was before `init`:

- The four skills are deleted from `.agents/skills/` and `.claude/skills/`.
- The harness-kit block is removed from `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`. A file that held nothing else is deleted; any other file keeps its own text.
- The harness-kit hooks are removed from `.claude/settings.json`, and the line from the git pre-commit hook. Your own hooks stay.
- `workflow/.kit/` is deleted, and so is every file in `workflow/` that is still identical to the template.
- **Files you or your agents wrote are kept**: feature specs and plans, the session log, and any `STATE.md`, `PROJECT.md`, `ROADMAP.md`, `DECISIONS.md` you edited. They are your project history.

Add `--purge` to delete the whole workflow folder, your documents included. Without `--yes`, nothing is touched. Review the result with `git status`; a commit can be reverted if it was not what you wanted.

If `workflow/` is not the folder name and the kit can no longer detect it, pass `--dir <folder>`.

## Development

```bash
npm test
```

## License

MIT
