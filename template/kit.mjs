#!/usr/bin/env node
// harness-kit runtime. Installed into <workflow dir>/.kit/kit.mjs and overwritten on update.
// No dependencies. Any agent or person can run it:
//   node <dir>/.kit/kit.mjs status        live snapshot: git, active feature, progress, drift
//   node <dir>/.kit/kit.mjs new <slug>    create the next numbered feature folder and make it active
//   node <dir>/.kit/kit.mjs doctor        check the installation and look for stray workflow documents
//   node <dir>/.kit/kit.mjs guard         hook mode: reject a workflow document written outside <dir>
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const kitDir = dirname(fileURLToPath(import.meta.url));
const wfAbs = dirname(kitDir);

const DEFAULTS = {
  dir: 'workflow',
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

function listFeatures() {
  if (!existsSync(featuresAbs)) return [];
  return readdirSync(featuresAbs)
    .filter((d) => /^\d{3}-/.test(d) && statSync(join(featuresAbs, d)).isDirectory())
    .sort();
}

function activeFeature() {
  return read(join(featuresAbs, 'ACTIVE')).trim();
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
  if (!has('spec.md')) return 'spec (spec.md not written yet)';
  const spec = read(join(featureAbs, 'spec.md'));
  if (/^Status:\s*draft/im.test(spec)) return 'spec (spec.md is still "Status: draft"; set "Status: approved" once the user approves it)';
  if (spec.includes('[NEEDS CLARIFICATION')) return 'spec (spec.md has unanswered [NEEDS CLARIFICATION] items)';
  if (!has('plan.md')) return 'plan (spec.md exists, plan.md does not)';
  if (!has('tasks.md')) return 'tasks (plan.md exists, tasks.md does not)';
  const s = taskStats(featureAbs);
  if (s && s.open.length) return `implement (${s.done}/${s.total} tasks done)`;
  if (!has('review.md')) return 'verify (all tasks ticked, review.md not written)';
  return 'done (review.md written) — hand off, then start the next feature';
}

function strayDocs() {
  const found = [];
  for (const rel of config.strayDirs) {
    const abs = join(root, rel);
    if (slash(abs).toLowerCase().startsWith(slash(wfAbs).toLowerCase())) continue;
    if (!existsSync(abs)) continue;
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

// ---------------------------------------------------------------- status
function status() {
  const out = [];
  const warn = [];

  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch) {
    const dirty = git('status', '--porcelain').split('\n').filter(Boolean).length;
    out.push(`Branch: ${branch} — ${dirty ? `${dirty} uncommitted file(s)` : 'clean'}`);
    const log = git('log', '-5', '--pretty=format:%h %s');
    if (log) out.push('Last commits:', ...log.split('\n').map((l) => `  ${l}`));
  } else {
    out.push('Git: not a repository, or no commits yet.');
  }

  const active = activeFeature();
  const features = listFeatures();
  if (active && existsSync(join(featuresAbs, active))) {
    const abs = join(featuresAbs, active);
    out.push(`Active feature: ${dir}/features/${active}`);
    out.push(`Stage: ${stageOf(abs)}`);
    const s = taskStats(abs);
    if (s && s.open.length) {
      out.push('Next open tasks:', ...s.open.slice(0, 5).map((l) => `  ${l.trim().slice(0, 160)}`));
    }
  } else if (active) {
    warn.push(`${dir}/features/ACTIVE names "${active}", which does not exist. Fix the file.`);
  } else if (features.length) {
    warn.push(`No active feature. Write one of [${features.slice(-3).join(', ')}] into ${dir}/features/ACTIVE, or start a new one.`);
  } else {
    out.push(`No features yet. Start one: node ${dir}/.kit/kit.mjs new <slug>`);
  }

  const others = features
    .filter((f) => f !== active)
    .map((f) => ({ f, s: taskStats(join(featuresAbs, f)) }))
    .filter(({ s }) => s && s.open.length);
  if (others.length) {
    out.push('Other features with open tasks: ' + others.map(({ f, s }) => `${f} (${s.open.length})`).join(', '));
  }

  const stateRel = `${dir}/STATE.md`;
  if (!existsSync(join(wfAbs, 'STATE.md'))) {
    warn.push(`${stateRel} is missing. Rebuild it from git log and the active feature's tasks.md.`);
  } else if (branch) {
    const last = git('log', '-1', '--format=%H', '--', stateRel);
    if (!last) {
      warn.push(`${stateRel} has never been committed.`);
    } else {
      const behind = Number(git('rev-list', '--count', `${last}..HEAD`)) || 0;
      if (behind > 0) warn.push(`${stateRel} is ${behind} commit(s) behind HEAD. Check it against the commits above, then update it.`);
    }
  }

  for (const { rel, count } of strayDocs()) {
    warn.push(`${count} markdown file(s) in ${rel}/ sit outside ${dir}/. Workflow documents belong in ${dir}/features/<NNN-slug>/.`);
  }

  console.log('<project-snapshot>');
  console.log(out.join('\n'));
  if (warn.length) console.log('\nNeeds attention:\n' + warn.map((w) => `  ! ${w}`).join('\n'));
  console.log(`\nRules: the harness-kit block in AGENTS.md. Documents go in ${dir}/.`);
  console.log('</project-snapshot>');
}

// ---------------------------------------------------------------- new
function newFeature(rawSlug) {
  const slug = String(rawSlug || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
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
  if (existsSync(template)) copyFileSync(template, join(abs, 'spec.md'));
  writeFileSync(join(featuresAbs, 'ACTIVE'), name + '\n');
  console.log(`Created ${dir}/features/${name}/ and made it the active feature.`);
  console.log(`Next: fill in ${dir}/features/${name}/spec.md`);
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
  if (rel.startsWith('..')) process.exit(0);
  const lower = rel.toLowerCase();
  if (!lower.endsWith('.md')) process.exit(0);
  if (lower === dir.toLowerCase() || lower.startsWith(dir.toLowerCase() + '/')) process.exit(0);

  const inStray = config.strayDirs.some((s) => lower.startsWith(s.toLowerCase().replace(/\/+$/, '') + '/'));
  const base = lower.split('/').pop();
  const isArtifact = config.artifactNames.map((n) => n.toLowerCase()).includes(base);
  if (!inStray && !isArtifact) process.exit(0);

  const active = activeFeature();
  const target = active ? `${dir}/features/${active}/` : `${dir}/features/<NNN-slug>/ (create it: node ${dir}/.kit/kit.mjs new <slug>)`;
  console.error(
    `harness-kit: "${rel}" is a workflow document outside ${dir}/. ` +
      `Write it to ${target} instead, using the artifact table in AGENTS.md ` +
      `(spec.md, plan.md, tasks.md, research.md, review.md). ` +
      `This applies even when another skill names a different default path.`,
  );
  process.exit(2);
}

// ---------------------------------------------------------------- doctor
function doctor() {
  const problems = [];
  const ok = [];
  const check = (cond, good, bad) => (cond ? ok.push(good) : problems.push(bad));

  const agents = read(join(root, 'AGENTS.md'));
  check(agents.includes('harness-kit:start'), 'AGENTS.md has the harness-kit block', 'AGENTS.md is missing the harness-kit block (run: npx github:7binh/harness-kit init)');
  check(existsSync(join(wfAbs, 'STATE.md')), `${dir}/STATE.md exists`, `${dir}/STATE.md is missing`);
  check(existsSync(join(wfAbs, 'DECISIONS.md')), `${dir}/DECISIONS.md exists`, `${dir}/DECISIONS.md is missing`);
  for (const skill of ['flow', 'catchup', 'handoff']) {
    check(existsSync(join(root, '.agents', 'skills', skill, 'SKILL.md')), `.agents/skills/${skill} installed`, `.agents/skills/${skill}/SKILL.md is missing`);
  }
  if ((config.agents || []).includes('claude')) {
    const settings = read(join(root, '.claude', 'settings.json'));
    check(settings.includes('.kit/kit.mjs'), 'Claude Code hooks registered', '.claude/settings.json has no harness-kit hooks');
    check(/@AGENTS\.md/.test(read(join(root, 'CLAUDE.md'))), 'CLAUDE.md imports AGENTS.md', 'CLAUDE.md does not import @AGENTS.md');
  }
  if ((config.agents || []).includes('gemini')) {
    check(/@AGENTS\.md/.test(read(join(root, 'GEMINI.md'))), 'GEMINI.md imports AGENTS.md', 'GEMINI.md does not import @AGENTS.md');
  }
  const active = activeFeature();
  if (active) check(existsSync(join(featuresAbs, active)), `active feature ${active} exists`, `${dir}/features/ACTIVE names "${active}", which does not exist`);

  for (const { rel, count } of strayDocs()) {
    problems.push(`${count} markdown file(s) in ${rel}/ are outside ${dir}/. To adopt them: git mv ${rel}/<folder> ${dir}/features/<NNN-slug>`);
  }

  ok.forEach((m) => console.log(`  ok  ${m}`));
  problems.forEach((m) => console.log(`  !!  ${m}`));
  console.log(problems.length ? `\n${problems.length} problem(s).` : '\nAll good.');
  process.exit(problems.length ? 1 : 0);
}

// ---------------------------------------------------------------- main
const [command, ...rest] = process.argv.slice(2);
try {
  if (command === 'status') status();
  else if (command === 'new') newFeature(rest.filter((a) => !a.startsWith('-')).join(' '));
  else if (command === 'guard') guard();
  else if (command === 'doctor') doctor();
  else {
    console.log('Usage: node ' + dir + '/.kit/kit.mjs <status | new <slug> | doctor | guard>');
    process.exit(command ? 1 : 0);
  }
} catch (err) {
  // A broken helper must never block a session or a tool call.
  console.log(`harness-kit ${command || ''} failed: ${err.message}`);
  process.exit(command === 'doctor' ? 1 : 0);
}
