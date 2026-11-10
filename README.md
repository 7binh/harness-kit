# harness-kit

One workflow folder and one set of rules for every AI coding agent.

[Tiếng Việt](README.vi.md)

AI coding sessions start with no memory, and each tool, skill, and plugin writes its specs and plans to a different place. harness-kit gives a project:

- **Memory that lives in the repository**: a state file and a decision log that every session reads first and updates last.
- **One home for working documents**: specs, plans, task lists, research, and reviews all go in `workflow/features/<NNN-slug>/`, whichever skill produced them.
- **Three skills that run the loop**: `flow`, `catchup`, `handoff`.
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

Options:

| Option | Meaning | Default |
|---|---|---|
| `--dir <path>` | The workflow folder, relative to the project root | `workflow` |
| `--agents <list>` | Extra adapters: `claude`, `gemini`, `all`, `none` | `all` |
| `--force` | Also overwrite `STATE.md`, `DECISIONS.md`, `README.md`, and the templates | off |

Running `init` again updates the kit. It replaces only its own block in `AGENTS.md`, its own hooks, its skills, and `.kit/kit.mjs`; your state, decisions, templates, and everything else in those files stay as they are.

Then commit `AGENTS.md` and `workflow/` so the memory travels with the repository.

## What gets installed

```text
AGENTS.md                     a managed block with the workflow rules (the rest of the file is yours)
CLAUDE.md, GEMINI.md          one line each: @AGENTS.md
workflow/
  STATE.md                    what is in flight, what is next, open questions
  DECISIONS.md                append-only decision log
  features/
    ACTIVE                    the folder name of the feature being worked on
    001-some-feature/         spec.md, plan.md, tasks.md, research.md, review.md
  notes/                      documents not tied to one feature
  templates/                  spec, plan, and tasks templates (edit them to fit)
  .kit/kit.mjs                helper script, no dependencies
  .kit/config.json            folder name, adapters, stray-document rules
.agents/skills/               flow, catchup, handoff
.claude/skills/               the same three, for Claude Code
.claude/settings.json         two hooks, merged into your existing settings
```

## Daily loop

1. **Open a session.** The agent runs `node workflow/.kit/kit.mjs status` and reads `STATE.md`. Ask for `catchup` after a gap.
2. **Describe a feature and ask for `flow`.** It creates `workflow/features/NNN-slug/` and runs one stage at a time: spec, plan, tasks, implement, verify. You review each document before the next stage builds on it.
3. **Stop for the day.** Ask for `handoff`. It ticks the finished tasks, logs decisions, and rewrites `STATE.md`.

In tools with slash commands for skills, these are `/flow`, `/catchup`, and `/handoff`. Elsewhere, ask in words: "run the flow skill".

### Commands

```bash
node workflow/.kit/kit.mjs status       # branch, last commits, active feature, stage, drift warnings
node workflow/.kit/kit.mjs new <slug>   # create the next numbered feature and make it active
node workflow/.kit/kit.mjs doctor       # check the installation, list stray documents
```

`npx github:7binh/harness-kit status | new | doctor` does the same from outside the folder.

## How documents stay in one place

Three layers, from soft to hard:

1. **A rule in `AGENTS.md`.** A table maps each kind of document to its path and states that this overrides any skill's default output folder.
2. **The `flow` skill.** It uses the best skill installed for each stage (Spec Kit, Superpowers, your own) for its method, and writes the result into the feature folder.
3. **A guard hook (Claude Code).** Creating `spec.md`, `plan.md`, `tasks.md`, `research.md`, or `prd.md` outside the workflow folder, or any new markdown file under `specs/`, `plans/`, `docs/specs/`, `docs/plans/`, `docs/superpowers/`, is rejected with a message naming the right path. Editing files that already exist is never blocked.

`status` and `doctor` report any stray document that still gets through, in every tool. Edit `strayDirs` and `artifactNames` in `workflow/.kit/config.json` to change what counts as stray.

## Tool support

| Tool | Reads the rules from | Reads skills from | Automatic hooks |
|---|---|---|---|
| Claude Code | `CLAUDE.md` → `AGENTS.md` | `.claude/skills/` | Yes: snapshot at session start, guard on writes |
| Codex | `AGENTS.md` | `.agents/skills/` | No |
| Cursor | `AGENTS.md` | `.agents/skills/` | No |
| Antigravity | `AGENTS.md` | `.agents/skills/` | No |
| OpenCode | `AGENTS.md` | `.agents/skills/` | No |
| Gemini CLI | `GEMINI.md` → `AGENTS.md` | `.agents/skills/` | No |
| Others (Copilot, Windsurf, ...) | `AGENTS.md` where supported | varies | No |

Without hooks, the agent follows the "Start of a session" rule in `AGENTS.md` and runs the status command itself. That depends on the model obeying its instructions; the hooks do not.

Notes:

- OpenCode also scans `.claude/skills/`, so with the Claude adapter installed it sees each skill twice. The copies are identical. Use `--agents gemini` or `--agents none` if you do not use Claude Code.
- Some Cursor versions have been reported not to list skills from `.agents/skills/`. If yours does not, copy the three folders into `.cursor/skills/`.
- The hooks run `node workflow/.kit/kit.mjs` relative to the folder where the session started. Start your agent from the project root.

## Adopting an existing project

`init` never moves your files. If you already have specs elsewhere, `doctor` lists them and prints the command to adopt them, for example:

```bash
git mv specs/003-trip-sharing workflow/features/003-trip-sharing
```

## Uninstall

Delete the workflow folder's `.kit/`, the three skill folders under `.agents/skills/` and `.claude/skills/`, the harness-kit block in `AGENTS.md`, and the two hook entries that mention `.kit/kit.mjs` in `.claude/settings.json`. Keep `workflow/` itself: it is your project history.

## Development

```bash
npm test
```

## License

MIT
