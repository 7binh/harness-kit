#!/usr/bin/env node
// harness-kit runtime. Installed into <workflow dir>/.kit/kit.mjs and overwritten on update.
// No dependencies. Any agent or person can run it:
//   status              live snapshot: git, active feature, stage, progress, drift
//   new <slug>          create the next numbered feature folder and make it active
//   use <name|number>   switch the active feature
//   list                every feature with its stage and task progress
//   log [text]          append a session entry to <dir>/log/YYYY-MM.md, or show recent entries
//   check               run the project's quality gates from config.json
//   doctor [--staged]   check the installation and look for stray workflow documents
//   guard               hook mode: reject a workflow document created outside <dir>
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const kitDir = dirname(fileURLToPath(import.meta.url));
const wfAbs = dirname(kitDir);

const DEFAULTS = {
  dir: 'workflow',
  agents: [],
  checks: [],
  strayDirs: ['specs', 'plans', 'docs/specs', 'docs/plans', 'docs/superpowers', '.specify/specs'],
  artifactNames: ['spec.md', 'plan.md', 'tasks.md', 'research.md', 'prd.md'],
};

function loadConfig() {
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(join(kitDir, 'config.json'), 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

const config = loadConfig();
const dir = config.dir.replace(/\\/g, '/').replace(/\/+$/, '');
const root = resolve(wfAbs, ...dir.split('/').map(() => '..'));
const featuresAbs = join(wfAbs, 'features');
const logAbs = join(wfAbs, 'log');
const PLACEHOLDER = '(not filled in)';

const slash = (p) => p.replace(/\\/g, '/');
const read = (abs) => {
  try {
    return readFileSync(abs, 'utf8');
  } catch {
    return '';
  }
};
const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};
const flag = (args, name) => {
  const i = args.indexOf(name);
  return i === -1 ? '' : args[i + 1] || '';
};

// ---------------------------------------------------------------- features
function listFeatures() {
  if (!existsSync(featuresAbs)) return [];
  return readdirSync(featuresAbs)
    .filter((d) => /^\d{3}-/.test(d) && statSync(join(featuresAbs, d)).isDirectory())
    .sort();
}

// A branch named after a feature (003-foo, feat/003-foo) selects it, so several features can be
// in flight on different branches and worktrees. Otherwise features/ACTIVE decides.
function activeFeature() {
  const features = listFeatures();
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  const m = branch.match(/(?:^|\/)(\d{3})-/);
  if (m) {
    const byBranch = features.find((f) => f.startsWith(`${m[1]}-`));
    if (byBranch) return { name: byBranch, source: `branch ${branch}` };
  }
  return { name: read(join(featuresAbs, 'ACTIVE')).trim(), source: `${dir}/features/ACTIVE` };
}

function taskStats(featureAbs) {
  const text = read(join(featureAbs, 'tasks.md'));
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  const open = lines.filter((l) => /^\s*- \[ \]/.test(l));
  const done = lines.filter((l) => /^\s*- \[[xX]\]/.test(l)).length;
  return { open, done, total: open.length + done };
}

function stageOf(featureAbs) {
  const has = (f) => existsSync(join(featureAbs, f));
  if (!has('spec.md')) return { key: 'spec', text: 'spec (spec.md not written yet)' };
  const spec = read(join(featureAbs, 'spec.md'));
  if (/^Status:\s*draft/im.test(spec)) {
    return { key: 'spec', text: 'spec (spec.md is still "Status: draft"; set "Status: approved" once the user approves it)' };
  }
  if (spec.includes('[NEEDS CLARIFICATION')) return { key: 'spec', text: 'spec (spec.md has unanswered [NEEDS CLARIFICATION] items)' };
  if (!has('plan.md')) return { key: 'plan', text: 'plan (spec.md approved, plan.md not written)' };
  if (!has('tasks.md')) return { key: 'tasks', text: 'tasks (plan.md exists, tasks.md does not)' };
  const s = taskStats(featureAbs);
  if (s && s.open.length) return { key: 'implement', text: `implement (${s.done}/${s.total} tasks done)` };
  if (!has('review.md')) return { key: 'verify', text: 'verify (all tasks ticked, review.md not written)' };
  return { key: 'done', text: 'done (review.md written) — hand off, then start the next feature' };
}

// ---------------------------------------------------------------- stray documents
const inWorkflow = (lower) => lower === dir.toLowerCase() || lower.startsWith(dir.toLowerCase() + '/');

function isStrayPath(rel) {
  const lower = slash(rel).toLowerCase();
  if (!lower.endsWith('.md') || lower.startsWith('..') || inWorkflow(lower)) return false;
  const inStrayDir = config.strayDirs.some((s) => lower.startsWith(s.toLowerCase().replace(/\/+$/, '') + '/'));
  const base = lower.split('/').pop();
  return inStrayDir || config.artifactNames.map((n) => n.toLowerCase()).includes(base);
}

function strayDirsOnDisk() {
  const found = [];
  for (const rel of config.strayDirs) {
    const abs = join(root, rel);
    if (inWorkflow(slash(rel).toLowerCase()) || !existsSync(abs)) continue;
    let count = 0;
    const walk = (p, depth) => {
      if (depth > 4) return;
      for (const e of readdirSync(p, { withFileTypes: true })) {
        if (e.isDirectory()) walk(join(p, e.name), depth + 1);
        else if (e.name.toLowerCase().endsWith('.md')) count += 1;
      }
    };
    try {
      walk(abs, 0);
    } catch {
      /* unreadable directory */
    }
    if (count) found.push({ rel, count });
  }
  return found;
}

// ---------------------------------------------------------------- event log
// Machine-written, local only (ignored by git). One JSON object per line.
function logEvent(type, data = {}) {
  try {
    const file = join(kitDir, 'events.jsonl');
    const line = JSON.stringify({ ts: new Date().toISOString(), type, branch: git('rev-parse', '--abbrev-ref', 'HEAD'), feature: activeFeature().name, ...data });
    if (existsSync(file) && statSync(file).size > 512 * 1024) {
      writeFileSync(file, readFileSync(file, 'utf8').split('\n').slice(-2000).join('\n'));
    }
    appendFileSync(file, line + '\n');
  } catch {
    /* logging must never break a command */
  }
}

// ---------------------------------------------------------------- status
function status(args) {
  const out = [];
  const warn = [];

  if (args.includes('--hook')) {
    let source = 'unknown';
    try {
      source = JSON.parse(readFileSync(0, 'utf8') || '{}').source || 'unknown';
    } catch {
      /* no payload */
    }
    logEvent('session-start', { source });
  }

  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch) {
    const dirty = git('status', '--porcelain').split('\n').filter(Boolean).length;
    out.push(`Branch: ${branch} — ${dirty ? `${dirty} uncommitted file(s)` : 'clean'}`);
    const log = git('log', '-5', '--pretty=format:%h %s');
    if (log) out.push('Last commits:', ...log.split('\n').map((l) => `  ${l}`));
  } else {
    out.push('Git: not a repository, or no commits yet.');
  }

  const { name: active, source } = activeFeature();
  const features = listFeatures();
  if (active && existsSync(join(featuresAbs, active))) {
    const abs = join(featuresAbs, active);
    out.push(`Active feature: ${dir}/features/${active} (from ${source})`);
    out.push(`Stage: ${stageOf(abs).text}`);
    const s = taskStats(abs);
    if (s && s.open.length) out.push('Next open tasks:', ...s.open.slice(0, 5).map((l) => `  ${l.trim().slice(0, 160)}`));
  } else if (active) {
    warn.push(`${dir}/features/ACTIVE names "${active}", which does not exist. Fix it: node ${dir}/.kit/kit.mjs use <name>`);
  } else if (features.length) {
    warn.push(`No active feature. Pick one: node ${dir}/.kit/kit.mjs use <name>  (see: node ${dir}/.kit/kit.mjs list)`);
  } else {
    out.push(`No features yet. Start one: node ${dir}/.kit/kit.mjs new <slug>`);
  }

  const others = features
    .filter((f) => f !== active)
    .map((f) => ({ f, stage: stageOf(join(featuresAbs, f)).key }))
    .filter(({ stage }) => stage !== 'done');
  if (others.length) {
    const shown = others.slice(-6).map(({ f, stage }) => `${f} [${stage}]`).join(', ');
    out.push(`Other unfinished features (${others.length}): ${shown}`);
  }

  const last = lastLogEntry();
  if (last) out.push(`Last session log: ${last.title}`);

  if (read(join(wfAbs, 'PROJECT.md')).includes(PLACEHOLDER)) {
    warn.push(`${dir}/PROJECT.md still has empty sections. Run the "onboard" skill to fill it from the codebase.`);
  }

  const stateRel = `${dir}/STATE.md`;
  if (!existsSync(join(wfAbs, 'STATE.md'))) {
    warn.push(`${stateRel} is missing. Rebuild it from git log and the active feature's tasks.md.`);
  } else if (branch) {
    const lastCommit = git('log', '-1', '--format=%H', '--', stateRel);
    if (!lastCommit) {
      warn.push(`${stateRel} has never been committed.`);
    } else {
      const behind = Number(git('rev-list', '--count', `${lastCommit}..HEAD`)) || 0;
      if (behind > 0) warn.push(`${stateRel} is ${behind} commit(s) behind HEAD. Check it against the commits above, then update it.`);
    }
  }

  for (const { rel, count } of strayDirsOnDisk()) {
    warn.push(`${count} markdown file(s) in ${rel}/ sit outside ${dir}/. Workflow documents belong in ${dir}/features/<NNN-slug>/.`);
  }

  console.log('<project-snapshot>');
  console.log(out.join('\n'));
  if (warn.length) console.log('\nNeeds attention:\n' + warn.map((w) => `  ! ${w}`).join('\n'));
  console.log(`\nRules: the harness-kit block in AGENTS.md. Project knowledge: ${dir}/PROJECT.md. Documents go in ${dir}/.`);
  console.log('</project-snapshot>');
}

// ---------------------------------------------------------------- new / use / list
function slugify(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
}

function newFeature(args) {
  const slug = slugify(args.filter((a) => !a.startsWith('-')).join(' '));
  if (!slug) {
    console.error('Usage: kit.mjs new <slug>   e.g. new trip-sharing');
    process.exit(1);
  }
  const numbers = listFeatures().map((f) => Number(f.slice(0, 3)));
  const next = String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(3, '0');
  const name = `${next}-${slug}`;
  const abs = join(featuresAbs, name);
  mkdirSync(abs, { recursive: true });
  const template = join(wfAbs, 'templates', 'spec.md');
  if (existsSync(template)) {
    const today = new Date().toISOString().slice(0, 10);
    writeFileSync(join(abs, 'spec.md'), read(template).replace('(YYYY-MM-DD)', today));
  }
  writeFileSync(join(featuresAbs, 'ACTIVE'), name + '\n');
  logEvent('feature-new', { feature: name });
  console.log(`Created ${dir}/features/${name}/ and made it the active feature.`);
  console.log(`Next: fill in ${dir}/features/${name}/spec.md`);
  console.log(`Tip: a branch named ${name} (or feat/${name}) selects this feature automatically.`);
}

function useFeature(args) {
  const wanted = (args[0] || '').trim();
  const features = listFeatures();
  const match = features.find((f) => f === wanted) || features.find((f) => f.startsWith(`${wanted.padStart(3, '0')}-`));
  if (!wanted || !match) {
    console.error(`Usage: kit.mjs use <name|number>. Features: ${features.join(', ') || '(none)'}`);
    process.exit(1);
  }
  writeFileSync(join(featuresAbs, 'ACTIVE'), match + '\n');
  logEvent('feature-use', { feature: match });
  console.log(`Active feature is now ${match}.`);
  const now = activeFeature();
  if (now.name !== match) console.log(`Note: the current ${now.source} still selects ${now.name}; branch names win over ACTIVE.`);
}

function list() {
  const features = listFeatures();
  if (!features.length) return console.log(`No features yet. Start one: node ${dir}/.kit/kit.mjs new <slug>`);
  const { name: active } = activeFeature();
  const width = Math.max(...features.map((f) => f.length));
  for (const f of features) {
    const abs = join(featuresAbs, f);
    const s = taskStats(abs);
    const progress = s ? `${s.done}/${s.total}` : '-';
    console.log(`${f === active ? '*' : ' '} ${f.padEnd(width)}  ${stageOf(abs).key.padEnd(9)}  tasks ${progress}`);
  }
  console.log('\n* = active');
}

// ---------------------------------------------------------------- session log
function logFiles() {
  if (!existsSync(logAbs)) return [];
  return readdirSync(logAbs).filter((f) => /^\d{4}-\d{2}\.md$/.test(f)).sort();
}

function logEntries() {
  return logFiles().flatMap((f) =>
    read(join(logAbs, f))
      .split(/^(?=## )/m)
      .filter((e) => e.startsWith('## '))
      .map((e) => ({ title: e.split('\n')[0].slice(3).trim(), body: e.trimEnd() })),
  );
}

function lastLogEntry() {
  return logEntries().at(-1);
}

function sessionLog(args) {
  const agent = flag(args, '--agent');
  const text = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--agent').join(' ').trim();

  if (!text) {
    const entries = logEntries().slice(-5);
    if (!entries.length) return console.log(`No session log yet. Add an entry: node ${dir}/.kit/kit.mjs log --agent <tool> "what was done"`);
    return console.log(entries.map((e) => e.body).join('\n\n'));
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const stamp = `${month}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD') || 'no-git';
  const head = git('rev-parse', '--short', 'HEAD');
  const { name: feature } = activeFeature();

  // Commits since the previous entry, taken from git so the log records facts, not recollection.
  const previous = (lastLogEntry()?.body.match(/^- HEAD: ([0-9a-f]+)/m) || [])[1];
  let commits = '';
  if (head && previous && previous !== head) commits = git('log', '--pretty=format:%h %s', '-30', `${previous}..HEAD`);
  const dirty = git('status', '--porcelain').split('\n').filter(Boolean).length;
  const stats = feature ? taskStats(join(featuresAbs, feature)) : null;

  const lines = [`## ${stamp} · ${branch} · ${feature || 'no feature'} · ${agent || 'agent not stated'}`, '', text, ''];
  if (head) lines.push(`- HEAD: ${head}${dirty ? ` (+${dirty} uncommitted file(s))` : ''}`);
  if (feature) lines.push(`- Stage: ${stageOf(join(featuresAbs, feature)).key}${stats ? `, tasks ${stats.done}/${stats.total}` : ''}`);
  if (commits) lines.push('- Commits since the last entry:', ...commits.split('\n').map((c) => `  - ${c}`));

  mkdirSync(logAbs, { recursive: true });
  const file = join(logAbs, `${month}.md`);
  if (!existsSync(file)) writeFileSync(file, `# Session log ${month}\n\nAppend-only. Written by \`kit.mjs log\`; one entry per handoff.\n`);
  appendFileSync(file, '\n' + lines.join('\n') + '\n');
  logEvent('session-log', { agent: agent || '' });
  console.log(`Logged to ${dir}/log/${month}.md`);
}

// ---------------------------------------------------------------- check
function check() {
  const checks = Array.isArray(config.checks) ? config.checks.filter((c) => c && c.command) : [];
  if (!checks.length) {
    console.log(`No checks configured. Add them to ${dir}/.kit/config.json, for example:`);
    console.log('  "checks": [ { "name": "tests", "command": "npm test" }, { "name": "build", "command": "npm run build" } ]');
    return;
  }
  const results = [];
  for (const c of checks) {
    const started = Date.now();
    const r = spawnSync(c.command, { cwd: root, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const ok = r.status === 0;
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    results.push({ name: c.name || c.command, ok, seconds: Number(seconds) });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name || c.command}  (${seconds}s)  $ ${c.command}`);
    if (!ok) {
      const tail = `${r.stdout || ''}\n${r.stderr || ''}`.trim().split(/\r?\n/).slice(-25).join('\n');
      console.log(tail.replace(/^/gm, '      '));
    }
  }
  logEvent('check', { results });
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length ? `\n${failed.length} of ${results.length} check(s) failed.` : `\nAll ${results.length} check(s) passed.`);
  process.exit(failed.length ? 1 : 0);
}

// ---------------------------------------------------------------- guard
// Hook mode. Reads a tool-call payload on stdin ({ tool_input: { file_path } }) and exits 2 with
// a message on stderr when the call would create a workflow document outside the workflow dir.
function guard() {
  let payload = {};
  try {
    payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    process.exit(0);
  }
  const input = payload.tool_input || payload.toolInput || {};
  const filePath = input.file_path || input.path || input.filePath;
  if (!filePath || typeof filePath !== 'string') process.exit(0);

  const abs = resolve(payload.cwd || root, filePath);
  if (existsSync(abs)) process.exit(0); // editing an existing file is never blocked
  const rel = slash(relative(root, abs));
  if (!isStrayPath(rel)) process.exit(0);

  const { name: active } = activeFeature();
  const target = active ? `${dir}/features/${active}/` : `${dir}/features/<NNN-slug>/ (create it: node ${dir}/.kit/kit.mjs new <slug>)`;
  logEvent('guard-block', { path: rel });
  console.error(
    `harness-kit: "${rel}" is a workflow document outside ${dir}/. ` +
      `Write it to ${target} instead, using the artifact table in AGENTS.md ` +
      `(spec.md, plan.md, tasks.md, research.md, review.md). ` +
      `This applies even when another skill names a different default path.`,
  );
  process.exit(2);
}

// ---------------------------------------------------------------- doctor
function doctor(args) {
  // --staged: the git pre-commit check. Only looks at files being added in this commit.
  if (args.includes('--staged')) {
    const added = git('diff', '--cached', '--name-only', '--diff-filter=A').split('\n').filter(Boolean);
    const stray = added.filter(isStrayPath);
    if (!stray.length) process.exit(0);
    console.error(`harness-kit: this commit adds workflow documents outside ${dir}/:`);
    stray.forEach((f) => console.error(`  ${f}`));
    console.error(`Move them into ${dir}/features/<NNN-slug>/ (or ${dir}/notes/), or commit with --no-verify if this is intended.`);
    logEvent('commit-block', { paths: stray });
    process.exit(1);
  }

  const problems = [];
  const ok = [];
  const check = (cond, good, bad) => (cond ? ok.push(good) : problems.push(bad));

  check(read(join(root, 'AGENTS.md')).includes('harness-kit:start'), 'AGENTS.md has the harness-kit block', 'AGENTS.md is missing the harness-kit block (run: npx github:7binh/harness-kit init)');
  for (const f of ['STATE.md', 'DECISIONS.md', 'PROJECT.md', 'ROADMAP.md']) {
    check(existsSync(join(wfAbs, f)), `${dir}/${f} exists`, `${dir}/${f} is missing (run: npx github:7binh/harness-kit init)`);
  }
  // Setup still to do is reported, but is not a failure: a fresh install is healthy.
  const todo = [];
  if (read(join(wfAbs, 'PROJECT.md')).includes(PLACEHOLDER)) todo.push(`${dir}/PROJECT.md has empty sections (run the "onboard" skill)`);
  if (!(config.checks || []).length) todo.push(`no quality checks in ${dir}/.kit/config.json (the "onboard" skill sets them)`);
  for (const skill of ['flow', 'catchup', 'handoff', 'onboard']) {
    check(existsSync(join(root, '.agents', 'skills', skill, 'SKILL.md')), `.agents/skills/${skill} installed`, `.agents/skills/${skill}/SKILL.md is missing`);
  }
  if ((config.agents || []).includes('claude')) {
    check(read(join(root, '.claude', 'settings.json')).includes('.kit/kit.mjs'), 'Claude Code hooks registered', '.claude/settings.json has no harness-kit hooks');
    check(/@(\.\/)?AGENTS\.md/.test(read(join(root, 'CLAUDE.md'))), 'CLAUDE.md imports AGENTS.md', 'CLAUDE.md does not import @AGENTS.md');
  }
  if ((config.agents || []).includes('gemini')) {
    check(/@(\.\/)?AGENTS\.md/.test(read(join(root, 'GEMINI.md'))), 'GEMINI.md imports AGENTS.md', 'GEMINI.md does not import @AGENTS.md');
  }
  const { name: active } = activeFeature();
  if (active) check(existsSync(join(featuresAbs, active)), `active feature ${active} exists`, `${dir}/features/ACTIVE names "${active}", which does not exist`);

  for (const { rel, count } of strayDirsOnDisk()) {
    problems.push(`${count} markdown file(s) in ${rel}/ are outside ${dir}/. To adopt them: git mv ${rel}/<folder> ${dir}/features/<NNN-slug>`);
  }

  ok.forEach((m) => console.log(`  ok  ${m}`));
  todo.forEach((m) => console.log(`  ..  to do: ${m}`));
  problems.forEach((m) => console.log(`  !!  ${m}`));
  console.log(problems.length ? `\n${problems.length} problem(s).` : '\nAll good.');
  process.exit(problems.length ? 1 : 0);
}

// ---------------------------------------------------------------- main
const [command, ...rest] = process.argv.slice(2);
const commands = { status, new: newFeature, use: useFeature, list, log: sessionLog, check, guard, doctor };
try {
  if (commands[command]) commands[command](rest);
  else {
    console.log(`Usage: node ${dir}/.kit/kit.mjs <status | new <slug> | use <name> | list | log [text] | check | doctor>`);
    process.exit(command ? 1 : 0);
  }
} catch (err) {
  // A broken helper must never block a session or a tool call.
  console.log(`harness-kit ${command || ''} failed: ${err.message}`);
  process.exit(['doctor', 'check'].includes(command) ? 1 : 0);
}
