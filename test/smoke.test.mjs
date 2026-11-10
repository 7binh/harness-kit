import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'harness-kit.mjs');
const run = (cwd, args, input) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', input });
const kit = (cwd, dir, args, input) => spawnSync(process.execPath, [join(cwd, dir, '.kit', 'kit.mjs'), ...args], { cwd, encoding: 'utf8', input });
const fresh = () => mkdtempSync(join(tmpdir(), 'harness-kit-'));
const read = (cwd, rel) => readFileSync(join(cwd, rel), 'utf8');
const write = (cwd, rel, text) => {
  mkdirSync(dirname(join(cwd, rel)), { recursive: true });
  writeFileSync(join(cwd, rel), text);
};
const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const freshRepo = () => {
  const cwd = fresh();
  git(cwd, 'init', '-q', '-b', 'main');
  write(cwd, 'app.txt', 'one\n');
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', 'first commit');
  return cwd;
};

test('init installs the workflow folder, rules, skills and adapters', () => {
  const cwd = fresh();
  const r = run(cwd, ['init']);
  assert.equal(r.status, 0, r.stderr);
  for (const rel of [
    'AGENTS.md',
    'CLAUDE.md',
    'GEMINI.md',
    'workflow/STATE.md',
    'workflow/DECISIONS.md',
    'workflow/PROJECT.md',
    'workflow/ROADMAP.md',
    'workflow/templates/spec.md',
    'workflow/.kit/kit.mjs',
    'workflow/.kit/config.json',
    'workflow/.kit/.gitignore',
    '.agents/skills/flow/SKILL.md',
    '.agents/skills/onboard/SKILL.md',
    '.claude/skills/handoff/SKILL.md',
    '.claude/settings.json',
  ]) {
    assert.ok(existsSync(join(cwd, rel)), `${rel} should exist`);
  }
  for (const rel of ['.agents/skills/flow/SKILL.md', 'workflow/ROADMAP.md', 'AGENTS.md']) {
    assert.ok(!read(cwd, rel).includes('{{DIR}}'), `${rel}: placeholders are filled`);
  }
  assert.match(read(cwd, 'CLAUDE.md'), /@AGENTS\.md\n@workflow\/PROJECT\.md\n@workflow\/STATE\.md/);
  assert.match(read(cwd, 'GEMINI.md'), /@\.\/AGENTS\.md\n@\.\/workflow\/PROJECT\.md/);
  const hooks = JSON.parse(read(cwd, '.claude/settings.json')).hooks;
  assert.equal(hooks.SessionStart.length, 1);
  assert.match(hooks.SessionStart[0].hooks[0].command, /status --hook$/);
  assert.equal(hooks.PreToolUse[0].matcher, 'Write|Edit|MultiEdit');
  assert.equal(run(cwd, ['doctor']).status, 0, 'a fresh install is healthy');
});

test('init is idempotent and preserves existing content', () => {
  const cwd = fresh();
  write(cwd, 'AGENTS.md', '# Mine\n\nKeep this line.\n');
  write(cwd, 'CLAUDE.md', '# Claude notes\n\n@AGENTS.md\n');
  write(cwd, '.claude/settings.json', JSON.stringify({ enabledPlugins: { x: true }, hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo hi' }] }] } }));

  run(cwd, ['init']);
  write(cwd, 'workflow/STATE.md', 'my state\n');
  const config = JSON.parse(read(cwd, 'workflow/.kit/config.json'));
  config.checks = [{ name: 'x', command: 'node -e 0' }];
  write(cwd, 'workflow/.kit/config.json', JSON.stringify(config));
  const second = run(cwd, ['init']);
  assert.equal(second.status, 0, second.stderr);

  const agents = read(cwd, 'AGENTS.md');
  assert.ok(agents.includes('Keep this line.'));
  assert.equal(agents.split('harness-kit:start').length - 1, 1, 'exactly one managed block');
  const claude = read(cwd, 'CLAUDE.md');
  assert.ok(claude.startsWith('# Claude notes'));
  assert.equal(claude.split('@AGENTS.md').length - 1, 1, 'an import the file already has is not repeated');
  assert.equal(claude.split('@workflow/STATE.md').length - 1, 1);
  assert.equal(read(cwd, 'workflow/STATE.md'), 'my state\n', 'user state is kept');
  assert.equal(JSON.parse(read(cwd, 'workflow/.kit/config.json')).checks.length, 1, 'user checks are kept');

  const settings = JSON.parse(read(cwd, '.claude/settings.json'));
  assert.deepEqual(settings.enabledPlugins, { x: true });
  assert.equal(settings.hooks.SessionStart.length, 2, 'user hook kept, kit hook added once');
});

test('--dir and --agents none', () => {
  const cwd = fresh();
  const r = run(cwd, ['init', '--dir', 'docs/workflow', '--agents', 'none']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(cwd, 'docs/workflow/.kit/kit.mjs')));
  assert.ok(!existsSync(join(cwd, 'CLAUDE.md')));
  assert.ok(!existsSync(join(cwd, '.claude')));
  assert.ok(read(cwd, 'AGENTS.md').includes('node docs/workflow/.kit/kit.mjs status'));
  // a re-run without --dir finds the existing folder instead of creating ./workflow
  run(cwd, ['init', '--agents', 'none']);
  assert.ok(!existsSync(join(cwd, 'workflow')));
  assert.equal(run(cwd, ['new', 'x']).status, 0);
  assert.ok(existsSync(join(cwd, 'docs/workflow/features/001-x/spec.md')));
});

test('new, use, list, status and stages', () => {
  const cwd = fresh();
  run(cwd, ['init']);
  const created = run(cwd, ['new', 'Chia sẻ chuyến đi']);
  assert.equal(created.status, 0, created.stderr);
  assert.equal(read(cwd, 'workflow/features/ACTIVE').trim(), '001-chia-se-chuyen-di');
  run(cwd, ['new', 'second']);
  assert.equal(read(cwd, 'workflow/features/ACTIVE').trim(), '002-second');

  assert.match(run(cwd, ['status']).stdout, /Active feature: workflow\/features\/002-second[\s\S]*Stage: spec \(spec\.md is still "Status: draft"/);
  const spec = 'workflow/features/002-second/spec.md';
  write(cwd, spec, read(cwd, spec).replace('Status: draft', 'Status: approved'));
  assert.match(run(cwd, ['status']).stdout, /Stage: plan/);
  write(cwd, 'workflow/features/002-second/plan.md', '# plan\n');
  write(cwd, 'workflow/features/002-second/tasks.md', '- [x] T001 a\n- [ ] T002 b\n');
  const status = run(cwd, ['status']).stdout;
  assert.match(status, /Stage: implement \(1\/2 tasks done\)[\s\S]*T002 b/);
  assert.match(status, /Other unfinished features \(1\): 001-chia-se-chuyen-di \[spec\]/);
  assert.match(status, /PROJECT\.md still has empty sections/);

  const list = run(cwd, ['list']).stdout;
  assert.match(list, /^ {2}001-chia-se-chuyen-di\s+spec\s+tasks -$/m);
  assert.match(list, /^\* 002-second\s+implement\s+tasks 1\/2$/m);

  assert.equal(run(cwd, ['use', '1']).status, 0);
  assert.equal(read(cwd, 'workflow/features/ACTIVE').trim(), '001-chia-se-chuyen-di');
  assert.equal(run(cwd, ['use', 'nope']).status, 1);
});

test('a branch named after a feature selects it', () => {
  const cwd = freshRepo();
  run(cwd, ['init']);
  run(cwd, ['new', 'alpha']);
  run(cwd, ['new', 'beta']);
  assert.match(run(cwd, ['status']).stdout, /Active feature: workflow\/features\/002-beta \(from workflow\/features\/ACTIVE\)/);
  git(cwd, 'switch', '-q', '-c', 'feat/001-alpha');
  assert.match(run(cwd, ['status']).stdout, /Active feature: workflow\/features\/001-alpha \(from branch feat\/001-alpha\)/);
});

test('session log records commits since the last entry', () => {
  const cwd = freshRepo();
  run(cwd, ['init']);
  run(cwd, ['new', 'demo']);
  assert.match(run(cwd, ['log']).stdout, /No session log yet/);

  assert.equal(run(cwd, ['log', '--agent', 'codex', 'Set up the kit.']).status, 0);
  write(cwd, 'app.txt', 'two\n');
  git(cwd, 'commit', '-q', '-am', 'second commit');
  run(cwd, ['log', '--agent', 'claude-code', 'Changed the app.']);

  const month = new Date();
  const file = `workflow/log/${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}.md`;
  const text = read(cwd, file);
  assert.equal(text.split('\n## ').length - 1, 2, 'two entries');
  assert.match(text, /· main · 001-demo · codex\n\nSet up the kit\./);
  assert.match(text, /· claude-code\n\nChanged the app\.[\s\S]*Commits since the last entry:\n {2}- [0-9a-f]+ second commit/);
  assert.match(run(cwd, ['status']).stdout, /Last session log: .* · claude-code/);
  assert.match(run(cwd, ['log']).stdout, /Changed the app\./);
});

test('check runs the configured quality gates', () => {
  const cwd = fresh();
  run(cwd, ['init']);
  assert.match(run(cwd, ['check']).stdout, /No checks configured/);
  const setChecks = (checks) => {
    const config = JSON.parse(read(cwd, 'workflow/.kit/config.json'));
    write(cwd, 'workflow/.kit/config.json', JSON.stringify({ ...config, checks }));
  };
  setChecks([{ name: 'ok', command: 'node -e "process.exit(0)"' }]);
  const pass = run(cwd, ['check']);
  assert.equal(pass.status, 0, pass.stdout);
  assert.match(pass.stdout, /PASS {2}ok[\s\S]*All 1 check\(s\) passed/);

  setChecks([{ name: 'ok', command: 'node -e "process.exit(0)"' }, { name: 'bad', command: 'node -e "console.log(\'boom\');process.exit(3)"' }]);
  const failed = run(cwd, ['check']);
  assert.equal(failed.status, 1);
  assert.match(failed.stdout, /FAIL {2}bad[\s\S]*boom[\s\S]*1 of 2 check\(s\) failed/);
  const events = read(cwd, 'workflow/.kit/events.jsonl').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(events.filter((e) => e.type === 'check').length, 2);
});

test('guard blocks new workflow documents outside the folder only, and logs it', () => {
  const cwd = fresh();
  run(cwd, ['init']);
  run(cwd, ['new', 'demo']);
  const guard = (file_path) => kit(cwd, 'workflow', ['guard'], JSON.stringify({ cwd, tool_input: { file_path } }));

  assert.equal(guard('docs/superpowers/specs/2026-design.md').status, 2);
  assert.equal(guard(join(cwd, 'specs', '003-x', 'notes.md')).status, 2, 'absolute paths too');
  const blocked = guard('PLAN.md');
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /workflow\/features\/001-demo\//);

  assert.equal(guard('workflow/features/001-demo/plan.md').status, 0);
  assert.equal(guard('docs/guide.md').status, 0);
  assert.equal(guard('src/app.ts').status, 0);
  write(cwd, 'plan.md', 'already here\n');
  assert.equal(guard('plan.md').status, 0, 'existing files can still be edited');
  assert.equal(kit(cwd, 'workflow', ['guard'], 'not json').status, 0);

  const events = read(cwd, 'workflow/.kit/events.jsonl').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(events.filter((e) => e.type === 'guard-block').length, 3);
  assert.equal(events.find((e) => e.type === 'guard-block').path, 'docs/superpowers/specs/2026-design.md');
});

test('doctor finds stray folders; --git-hook blocks committing stray documents', () => {
  const cwd = freshRepo();
  const r = run(cwd, ['init', '--git-hook']);
  assert.match(r.stdout, /created\s+git pre-commit hook/);
  assert.match(run(cwd, ['init', '--git-hook']).stdout, /unchanged\s+git pre-commit hook/);
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', 'install harness-kit');

  write(cwd, 'specs/001-x/spec.md', '# stray\n');
  const doctor = run(cwd, ['doctor']);
  assert.equal(doctor.status, 1);
  assert.match(doctor.stdout, /specs\/ are outside workflow\//);

  git(cwd, 'add', '-A');
  const staged = kit(cwd, 'workflow', ['doctor', '--staged']);
  assert.equal(staged.status, 1);
  assert.match(staged.stderr, /specs\/001-x\/spec\.md/);

  git(cwd, 'rm', '-q', '--cached', '-r', 'specs');
  write(cwd, 'workflow/notes/idea.md', '# fine\n');
  git(cwd, 'add', 'workflow');
  assert.equal(kit(cwd, 'workflow', ['doctor', '--staged']).status, 0);
});

test('uninstall returns the project to how it was before init, and keeps your documents', () => {
  const cwd = freshRepo();
  const settings = { enabledPlugins: { x: true }, hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo hi' }] }] } };
  write(cwd, 'AGENTS.md', '# Mine\n\nKeep this line.\n');
  write(cwd, 'CLAUDE.md', '# Claude notes\n\n@AGENTS.md\n');
  write(cwd, '.claude/settings.json', JSON.stringify(settings, null, 2) + '\n');
  run(cwd, ['init', '--git-hook']);
  run(cwd, ['new', 'demo']);
  assert.ok(existsSync(join(cwd, '.git/hooks/pre-commit')));

  const dry = run(cwd, ['uninstall']);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /nothing has been changed yet[\s\S]*--yes/);
  assert.ok(existsSync(join(cwd, 'workflow/.kit/kit.mjs')), 'a dry run touches nothing');
  assert.ok(existsSync(join(cwd, '.agents/skills/flow')));

  const real = run(cwd, ['uninstall', '--yes']);
  assert.equal(real.status, 0, real.stdout + real.stderr);
  assert.equal(read(cwd, 'AGENTS.md').trim(), '# Mine\n\nKeep this line.');
  assert.equal(read(cwd, 'CLAUDE.md').trim(), '# Claude notes\n\n@AGENTS.md');
  assert.deepEqual(JSON.parse(read(cwd, '.claude/settings.json')), settings);
  for (const gone of ['GEMINI.md', '.agents', '.claude/skills', '.git/hooks/pre-commit', 'workflow/.kit', 'workflow/STATE.md', 'workflow/templates', 'workflow/notes']) {
    assert.ok(!existsSync(join(cwd, gone)), `${gone} should be gone`);
  }
  assert.ok(existsSync(join(cwd, 'workflow/features/001-demo/spec.md')), 'documents written for a feature stay');
  assert.match(real.stdout, /Kept \d+ file/);

  const purge = run(cwd, ['uninstall', '--yes', '--purge', '--dir', 'workflow']);
  assert.equal(purge.status, 0, purge.stdout + purge.stderr);
  assert.ok(!existsSync(join(cwd, 'workflow')));
});

test('uninstall --purge on a fresh install leaves nothing behind', () => {
  const cwd = fresh();
  run(cwd, ['init', '--agents', 'all']);
  const r = run(cwd, ['uninstall', '--yes', '--purge']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(readdirSync(cwd), []);
  assert.notEqual(run(cwd, ['uninstall']).status, 0, 'nothing installed: it says so');
});
