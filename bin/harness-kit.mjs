#!/usr/bin/env node
// harness-kit installer. Zero dependencies, Node 18+.
//   npx github:7binh/harness-kit init [--dir workflow] [--agents claude,gemini] [--force]
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templateRoot = join(pkgRoot, 'template');
const version = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')).version;

// Tools that need a file of their own. Everything else (Codex, Cursor, Antigravity, OpenCode,
// Gemini CLI skills, Copilot, Windsurf, ...) is covered by AGENTS.md and .agents/skills/.
const ADAPTERS = ['claude', 'gemini'];
const START = '<!-- harness-kit:start';
const END = '<!-- harness-kit:end -->';

const HELP = `harness-kit ${version}
One workflow folder and one set of rules for every AI coding agent.

Usage
  harness-kit init [options]     install into the current project (safe to re-run; also updates)
  harness-kit status             where the project stands
  harness-kit new <slug>         start the next feature
  harness-kit use <name>         switch the active feature
  harness-kit list               every feature with its stage and progress
  harness-kit log [text]         add a session log entry, or show recent ones
  harness-kit check              run the project's quality checks
  harness-kit doctor             check the installation, find stray documents
  harness-kit uninstall          remove the kit and return the project to how it was before init
                                 (lists what it would do; add --yes to do it)

Options for uninstall
  --yes, -y          actually make the changes (without it, nothing is touched)
  --purge            also delete everything in the workflow folder, including your own documents
  --dir <path>       the workflow folder, if it can no longer be detected

Options for init
  --dir <path>       workflow folder, relative to the project root (default: workflow)
  --agents <list>    extra adapters: claude, gemini, all, none (default: all)
  --git-hook         add a git pre-commit check that rejects stray workflow documents (works in every tool)
  --force            also overwrite the files you own (STATE, DECISIONS, PROJECT, ROADMAP, README, templates)
  -h, --help         show this help
  -v, --version      show the version
`;

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--force') opts.force = true;
    else if (a === '--git-hook') opts.gitHook = true;
    else if (a === '--yes' || a === '-y') opts.yes = true;
    else if (a === '--purge') opts.purge = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a === '-v' || a === '--version') opts.version = true;
    else if (a === '--dir' || a === '--agents') opts[a.slice(2)] = argv[++i];
    else if (a.startsWith('--dir=')) opts.dir = a.slice(6);
    else if (a.startsWith('--agents=')) opts.agents = a.slice(9);
    else if (a.startsWith('-')) fail(`Unknown option: ${a}\n\n${HELP}`);
    else opts._.push(a);
  }
  return opts;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const log = [];
const note = (action, path) => log.push(`  ${action.padEnd(9)} ${path.replace(/\\/g, '/')}`);

function writeFile(root, rel, content, { overwrite }) {
  const abs = join(root, rel);
  const exists = existsSync(abs);
  if (exists && !overwrite) return note('kept', rel);
  if (exists && readFileSync(abs, 'utf8') === content) return note('unchanged', rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  note(exists ? 'updated' : 'created', rel);
}

function walk(abs, base = abs) {
  return readdirSync(abs).flatMap((name) => {
    const p = join(abs, name);
    return statSync(p).isDirectory() ? walk(p, base) : [p.slice(base.length + 1)];
  });
}

function findInstalledDir(root) {
  const candidates = ['workflow', ...readdirSync(root).filter((d) => !d.startsWith('.') && d !== 'node_modules')];
  for (const d of candidates) {
    if (existsSync(join(root, d, '.kit', 'config.json'))) return d;
    // one level deeper, e.g. docs/workflow
    const abs = join(root, d);
    if (existsSync(abs) && statSync(abs).isDirectory()) {
      for (const sub of readdirSync(abs)) {
        if (existsSync(join(abs, sub, '.kit', 'config.json'))) return `${d}/${sub}`;
      }
    }
  }
  return '';
}

// Insert or replace the managed block, leaving the rest of the file alone.
function upsertBlock(existing, block, heading = '# Agent Instructions\n\n') {
  const start = existing.indexOf(START);
  const end = existing.indexOf(END);
  if (start !== -1 && end > start) {
    return existing.slice(0, start) + block.trimEnd() + existing.slice(end + END.length);
  }
  if (!existing.trim()) return `${heading}${block.trimEnd()}\n`;
  return `${existing.trimEnd()}\n\n${block.trimEnd()}\n`;
}

// CLAUDE.md / GEMINI.md: a managed block of imports, so these tools load the rules, the project
// knowledge and the current state into every session. Imports the file already has are not repeated.
function ensureImports(root, file, dir, prefix) {
  const abs = join(root, file);
  const text = existsSync(abs) ? readFileSync(abs, 'utf8') : '';
  const start = text.indexOf(START);
  const end = text.indexOf(END);
  const outside = start !== -1 && end > start ? text.slice(0, start) + text.slice(end + END.length) : text;
  const present = outside.split(/\r?\n/).map((l) => l.trim().replace(/^@\.\//, '@'));
  const lines = ['AGENTS.md', `${dir}/PROJECT.md`, `${dir}/STATE.md`].filter((p) => !present.includes(`@${p}`)).map((p) => `@${prefix}${p}`);
  const block = `${START} (managed by harness-kit init) -->\n${lines.join('\n')}\n${END}`;
  writeFile(root, file, upsertBlock(text, block, ''), { overwrite: true });
}

// Opt-in git pre-commit check. Tool-independent: it runs whichever agent made the commit.
function installGitHook(root, dir) {
  let hooksDir = '';
  try {
    hooksDir = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return note('SKIPPED', 'git pre-commit hook (not a git repository)');
  }
  const abs = resolve(root, hooksDir, 'pre-commit');
  const line = `node ${dir}/.kit/kit.mjs doctor --staged || exit 1`;
  if (existsSync(abs)) {
    if (readFileSync(abs, 'utf8').includes('.kit/kit.mjs')) return note('unchanged', 'git pre-commit hook');
    return note('SKIPPED', `git pre-commit hook already exists; add this line to it: ${line}`);
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `#!/bin/sh\n# harness-kit: keep workflow documents inside ${dir}/\n${line}\n`);
  try {
    chmodSync(abs, 0o755);
  } catch {
    /* not needed on Windows */
  }
  note('created', 'git pre-commit hook');
}

function installClaudeHooks(root, dir) {
  const rel = '.claude/settings.json';
  const abs = join(root, rel);
  let settings = {};
  if (existsSync(abs)) {
    try {
      settings = JSON.parse(readFileSync(abs, 'utf8'));
    } catch {
      return note('SKIPPED', `${rel} (not valid JSON; add the hooks by hand, see README)`);
    }
  }
  const before = JSON.stringify(settings);
  settings.hooks ??= {};
  const wanted = {
    SessionStart: { hooks: [{ type: 'command', command: `node ${dir}/.kit/kit.mjs status --hook`, timeout: 15 }] },
    PreToolUse: {
      matcher: 'Write|Edit|MultiEdit',
      hooks: [{ type: 'command', command: `node ${dir}/.kit/kit.mjs guard`, timeout: 10 }],
    },
  };
  for (const [event, entry] of Object.entries(wanted)) {
    const list = Array.isArray(settings.hooks[event]) ? settings.hooks[event] : [];
    // Drop any earlier harness-kit entry (the folder may have changed), keep everything else.
    settings.hooks[event] = list.filter((e) => !JSON.stringify(e).includes('.kit/kit.mjs'));
    settings.hooks[event].push(entry);
  }
  if (JSON.stringify(settings) === before) return note('unchanged', rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(settings, null, 2) + '\n');
  note(before === '{}' ? 'created' : 'updated', rel);
}

function init(opts) {
  const root = process.cwd();
  const dir = (opts.dir || findInstalledDir(root) || 'workflow').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
  if (!dir || dir.startsWith('/') || dir.includes('..') || /^[a-zA-Z]:/.test(dir)) {
    fail('--dir must be a folder inside the project, for example: workflow or docs/workflow');
  }

  const requested = (opts.agents ?? 'all').toLowerCase();
  const agents = requested === 'all' ? ADAPTERS : requested === 'none' ? [] : requested.split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = agents.filter((a) => !ADAPTERS.includes(a));
  if (unknown.length) {
    fail(`Unknown adapter: ${unknown.join(', ')}. Adapters are: ${ADAPTERS.join(', ')}.\nCodex, Cursor, Antigravity, OpenCode and others need no adapter: they read AGENTS.md and .agents/skills/.`);
  }

  const fill = (text) => text.replaceAll('{{DIR}}', dir);

  // 1. The workflow folder. User-owned files are kept unless --force.
  for (const rel of walk(join(templateRoot, 'workflow'))) {
    writeFile(root, join(dir, rel), fill(readFileSync(join(templateRoot, 'workflow', rel), 'utf8')), { overwrite: !!opts.force });
  }
  for (const sub of ['features', 'notes']) {
    writeFile(root, join(dir, sub, '.gitkeep'), '', { overwrite: false });
  }

  // 2. The runtime script (kit-owned, always refreshed) and its config (user keys preserved).
  writeFile(root, join(dir, '.kit', 'kit.mjs'), readFileSync(join(templateRoot, 'kit.mjs'), 'utf8'), { overwrite: true });
  const configPath = join(root, dir, '.kit', 'config.json');
  let config = {};
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch {
    /* first install */
  }
  config = {
    checks: [],
    strayDirs: ['specs', 'plans', 'docs/specs', 'docs/plans', 'docs/superpowers', '.specify/specs'],
    artifactNames: ['spec.md', 'plan.md', 'tasks.md', 'research.md', 'prd.md'],
    ...config,
    version,
    dir,
    agents,
  };
  writeFile(root, join(dir, '.kit', 'config.json'), JSON.stringify(config, null, 2) + '\n', { overwrite: true });
  writeFile(root, join(dir, '.kit', '.gitignore'), 'events.jsonl\n', { overwrite: true });

  // 3. AGENTS.md: the one file every tool reads.
  const agentsPath = join(root, 'AGENTS.md');
  const existing = existsSync(agentsPath) ? readFileSync(agentsPath, 'utf8') : '';
  writeFile(root, 'AGENTS.md', upsertBlock(existing, fill(readFileSync(join(templateRoot, 'AGENTS.block.md'), 'utf8'))), { overwrite: true });

  // 4. Skills: .agents/skills/ is the shared location; Claude Code reads .claude/skills/.
  const skillTargets = ['.agents/skills', ...(agents.includes('claude') ? ['.claude/skills'] : [])];
  for (const rel of walk(join(templateRoot, 'skills'))) {
    const content = fill(readFileSync(join(templateRoot, 'skills', rel), 'utf8'));
    for (const target of skillTargets) writeFile(root, join(target, rel), content, { overwrite: true });
  }

  // 5. Adapters.
  if (agents.includes('claude')) {
    ensureImports(root, 'CLAUDE.md', dir, '');
    installClaudeHooks(root, dir);
  }
  if (agents.includes('gemini')) ensureImports(root, 'GEMINI.md', dir, './');
  if (opts.gitHook) installGitHook(root, dir);

  console.log(`harness-kit ${version} installed in ${root}\n`);
  console.log(log.join('\n'));
  console.log(`
Next
  1. Open your agent in this folder and ask for "onboard". It studies the codebase and
     fills in ${dir}/PROJECT.md, the context map, and the quality checks.
  2. Describe a feature and ask for "flow".
  3. Before you stop, ask for "handoff". Next time, ask for "catchup".
  4. Commit AGENTS.md and ${dir}/ so the memory travels with the repository.
  Guide: ${dir}/README.md
`);
}

// ---------------------------------------------------------------- uninstall
const SKILLS = ['onboard', 'flow', 'catchup', 'handoff'];

// Remove the managed block; returns the remaining text, or null when there is no block.
function stripBlock(text) {
  const start = text.indexOf(START);
  const end = text.indexOf(END);
  if (start === -1 || end < start) return null;
  const before = text.slice(0, start).trimEnd();
  const after = text.slice(end + END.length).trimStart();
  const joined = [before, after].filter(Boolean).join('\n\n');
  return joined ? `${joined}\n` : '';
}

function pruneEmptyDirs(abs) {
  if (!existsSync(abs) || !statSync(abs).isDirectory()) return;
  for (const name of readdirSync(abs)) pruneEmptyDirs(join(abs, name));
  if (!readdirSync(abs).length) rmdirSync(abs);
}

function uninstall(opts) {
  const root = process.cwd();
  const dir = (opts.dir || findInstalledDir(root)).replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
  if (!dir || dir.startsWith('/') || dir.includes('..') || /^[a-zA-Z]:/.test(dir)) {
    fail('Cannot find the harness-kit workflow folder here. If it is not "workflow", pass it: harness-kit uninstall --dir <folder>');
  }
  const fill = (text) => text.replaceAll('{{DIR}}', dir);
  const steps = [];
  const kept = [];
  const step = (text, run) => steps.push({ text, run });

  // Skills (kit-owned names).
  for (const base of ['.agents/skills', '.claude/skills']) {
    for (const name of SKILLS) {
      const rel = `${base}/${name}`;
      if (existsSync(join(root, rel))) step(`delete ${rel}/`, () => rmSync(join(root, rel), { recursive: true, force: true }));
    }
  }

  // Managed blocks. A file that held nothing but the block is deleted; any other file keeps its own text.
  for (const file of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']) {
    const abs = join(root, file);
    if (!existsSync(abs)) continue;
    const stripped = stripBlock(readFileSync(abs, 'utf8'));
    if (stripped === null) continue;
    const onlyOurs = !stripped.trim() || (file === 'AGENTS.md' && stripped.trim() === '# Agent Instructions');
    if (onlyOurs) step(`delete ${file} (it held only the harness-kit block)`, () => rmSync(abs));
    else step(`remove the harness-kit block from ${file} (the rest is kept)`, () => writeFileSync(abs, stripped));
  }

  // Claude Code hooks.
  const settingsRel = '.claude/settings.json';
  const settingsAbs = join(root, settingsRel);
  if (existsSync(settingsAbs)) {
    let settings = null;
    try {
      settings = JSON.parse(readFileSync(settingsAbs, 'utf8'));
    } catch {
      /* not valid JSON: leave it alone */
    }
    if (settings?.hooks && JSON.stringify(settings.hooks).includes('.kit/kit.mjs')) {
      for (const [event, list] of Object.entries(settings.hooks)) {
        const left = (Array.isArray(list) ? list : []).filter((e) => !JSON.stringify(e).includes('.kit/kit.mjs'));
        if (left.length) settings.hooks[event] = left;
        else delete settings.hooks[event];
      }
      if (!Object.keys(settings.hooks).length) delete settings.hooks;
      if (!Object.keys(settings).length) step(`delete ${settingsRel} (it held only harness-kit hooks)`, () => rmSync(settingsAbs));
      else step(`remove the harness-kit hooks from ${settingsRel} (the rest is kept)`, () => writeFileSync(settingsAbs, JSON.stringify(settings, null, 2) + '\n'));
    }
  }

  // Git pre-commit hook.
  try {
    const hooksDir = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const abs = resolve(root, hooksDir, 'pre-commit');
    if (existsSync(abs) && readFileSync(abs, 'utf8').includes('.kit/kit.mjs')) {
      const left = readFileSync(abs, 'utf8').split(/\r?\n/).filter((l) => !l.includes('.kit/kit.mjs') && !l.startsWith('# harness-kit:'));
      if (left.every((l) => !l.trim() || l.trim() === '#!/bin/sh')) step('delete the git pre-commit hook (it held only the harness-kit check)', () => rmSync(abs));
      else step('remove the harness-kit line from the git pre-commit hook (the rest is kept)', () => writeFileSync(abs, left.join('\n')));
    }
  } catch {
    /* not a git repository */
  }

  // The workflow folder.
  const wfAbs = join(root, dir);
  if (existsSync(wfAbs)) {
    if (opts.purge) {
      step(`delete ${dir}/ and everything in it (--purge)`, () => rmSync(wfAbs, { recursive: true, force: true }));
    } else {
      step(`delete ${dir}/.kit/`, () => rmSync(join(wfAbs, '.kit'), { recursive: true, force: true }));
      for (const rel of walk(wfAbs)) {
        const p = rel.replace(/\\/g, '/');
        if (p.startsWith('.kit/')) continue;
        const current = readFileSync(join(wfAbs, rel), 'utf8').replace(/\r\n/g, '\n');
        const template = join(templateRoot, 'workflow', rel);
        const pristine = existsSync(template) ? fill(readFileSync(template, 'utf8')).replace(/\r\n/g, '\n') === current : p.endsWith('.gitkeep') && current === '';
        if (pristine) step(`delete ${dir}/${p} (unchanged from the template)`, () => rmSync(join(wfAbs, rel)));
        else kept.push(`${dir}/${p}`);
      }
      step(`delete empty folders in ${dir}/`, () => pruneEmptyDirs(wfAbs));
    }
  }
  step('delete empty .agents/ and .claude/ folders', () => {
    for (const rel of ['.agents/skills', '.agents', '.claude/skills', '.claude']) {
      const abs = join(root, rel);
      if (existsSync(abs) && statSync(abs).isDirectory() && !readdirSync(abs).length) rmdirSync(abs);
    }
  });

  if (!opts.yes) {
    console.log('harness-kit uninstall: nothing has been changed yet. It would:\n');
    steps.forEach((s) => console.log(`  - ${s.text}`));
  } else {
    steps.forEach((s) => {
      s.run();
      console.log(`  done  ${s.text}`);
    });
  }
  if (kept.length) {
    console.log(`\n${opts.yes ? 'Kept' : 'Would keep'} ${kept.length} file(s) you or your agents wrote:`);
    kept.slice(0, 15).forEach((f) => console.log(`  ${f}`));
    if (kept.length > 15) console.log(`  ... and ${kept.length - 15} more`);
    console.log('Delete them as well with --purge.');
  }
  console.log(opts.yes ? '\nDone. The project no longer uses harness-kit. Review with: git status' : '\nRun the same command with --yes to apply. Nothing is deleted without it.');
}

function delegate(command, args) {
  const root = process.cwd();
  const dir = findInstalledDir(root);
  if (!dir) fail('harness-kit is not installed in this folder. Run: harness-kit init');
  const result = spawnSync(process.execPath, [join(root, dir, '.kit', 'kit.mjs'), command, ...args], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

const RUNTIME = ['status', 'new', 'use', 'list', 'log', 'check', 'doctor'];
if (RUNTIME.includes(process.argv[2])) {
  // Runtime commands have their own options; pass everything through untouched.
  delegate(process.argv[2], process.argv.slice(3));
} else {
  const opts = parseArgs(process.argv.slice(2));
  const [command] = opts._;
  if (opts.version) console.log(version);
  else if (opts.help || !command) console.log(HELP);
  else if (command === 'init' || command === 'update') init(opts);
  else if (command === 'uninstall' || command === 'remove') uninstall(opts);
  else fail(`Unknown command: ${command}\n\n${HELP}`);
}
