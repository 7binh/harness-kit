import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'harness-kit.mjs');
const run = (cwd, args, input) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', input });
const kit = (cwd, dir, args, input) => spawnSync(process.execPath, [join(cwd, dir, '.kit', 'kit.mjs'), ...args], { cwd, encoding: 'utf8', input });
const fresh = () => mkdtempSync(join(tmpdir(), 'harness-kit-'));
const read = (cwd, rel) => readFileSync(join(cwd, rel), 'utf8');

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
    'workflow/templates/spec.md',
    'workflow/.kit/kit.mjs',
    'workflow/.kit/config.json',
    '.agents/skills/flow/SKILL.md',
    '.claude/skills/handoff/SKILL.md',
    '.claude/settings.json',
  ]) {
    assert.ok(existsSync(join(cwd, rel)), `${rel} should exist`);
  }
  assert.ok(!read(cwd, '.agents/skills/flow/SKILL.md').includes('{{DIR}}'), 'placeholders are filled');
  const hooks = JSON.parse(read(cwd, '.claude/settings.json')).hooks;
  assert.equal(hooks.SessionStart.length, 1);
  assert.equal(hooks.PreToolUse[0].matcher, 'Write|Edit|MultiEdit');
});

test('init is idempotent and preserves existing content', () => {
  const cwd = fresh();
  writeFileSync(join(cwd, 'AGENTS.md'), '# Mine\n\nKeep this line.\n');
  writeFileSync(join(cwd, 'CLAUDE.md'), '# Claude notes\n');
  mkdirSync(join(cwd, '.claude'));
  writeFileSync(join(cwd, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { x: true }, hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo hi' }] }] } }));

  run(cwd, ['init']);
  writeFileSync(join(cwd, 'workflow', 'STATE.md'), 'my state\n');
  const second = run(cwd, ['init']);
  assert.equal(second.status, 0, second.stderr);

  const agents = read(cwd, 'AGENTS.md');
  assert.ok(agents.includes('Keep this line.'));
  assert.equal(agents.split('harness-kit:start').length - 1, 1, 'exactly one managed block');
  assert.ok(read(cwd, 'CLAUDE.md').startsWith('# Claude notes'));
  assert.equal(read(cwd, 'CLAUDE.md').split('@AGENTS.md').length - 1, 1);
  assert.equal(read(cwd, 'workflow/STATE.md'), 'my state\n', 'user state is kept');

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
});

test('new, status and doctor', () => {
  const cwd = fresh();
  run(cwd, ['init']);
  const created = run(cwd, ['new', 'Chia sẻ chuyến đi']);
  assert.equal(created.status, 0, created.stderr);
  assert.equal(read(cwd, 'workflow/features/ACTIVE').trim(), '001-chia-se-chuyen-di');
  assert.ok(existsSync(join(cwd, 'workflow/features/001-chia-se-chuyen-di/spec.md')));
  run(cwd, ['new', 'second']);
  assert.equal(read(cwd, 'workflow/features/ACTIVE').trim(), '002-second');

  const status = run(cwd, ['status']);
  assert.match(status.stdout, /Active feature: workflow\/features\/002-second/);
  assert.match(status.stdout, /Stage: spec \(spec\.md is still "Status: draft"/);
  const specPath = join(cwd, 'workflow/features/002-second/spec.md');
  writeFileSync(specPath, read(cwd, 'workflow/features/002-second/spec.md').replace('Status: draft', 'Status: approved'));
  assert.match(run(cwd, ['status']).stdout, /Stage: plan/);
  writeFileSync(join(cwd, 'workflow/features/002-second/plan.md'), '# plan\n');
  writeFileSync(join(cwd, 'workflow/features/002-second/tasks.md'), '- [x] T001 a\n- [ ] T002 b\n');
  assert.match(run(cwd, ['status']).stdout, /Stage: implement \(1\/2 tasks done\)[\s\S]*T002 b/);

  assert.equal(run(cwd, ['doctor']).status, 0);
  mkdirSync(join(cwd, 'specs', '001-x'), { recursive: true });
  writeFileSync(join(cwd, 'specs', '001-x', 'spec.md'), '# stray\n');
  const doctor = run(cwd, ['doctor']);
  assert.equal(doctor.status, 1);
  assert.match(doctor.stdout, /specs\/ are outside workflow\//);
});

test('guard blocks new workflow documents outside the folder only', () => {
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
  writeFileSync(join(cwd, 'plan.md'), 'already here\n');
  assert.equal(guard('plan.md').status, 0, 'existing files can still be edited');
  assert.equal(kit(cwd, 'workflow', ['guard'], 'not json').status, 0);
});
