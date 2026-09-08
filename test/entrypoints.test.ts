import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fixture, change } from './helpers.js';

const cli = resolve('build/cli.js');
const action = resolve('dist/keystoneAction.js');

test('compiled CLI dry run creates a report, refuses overwrite, and reports bad refs', async t => {
  const repo = await fixture(t);
  await change(repo);
  const output = join(repo, 'report.json');
  const run = (...args: string[]) => spawnSync(process.execPath, [cli, '--repo', repo, ...args], { encoding: 'utf8', windowsHide: true });
  const result = run('--dry-run', '--output', output);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Record saved successfully/);
  assert.equal(JSON.parse(result.stdout).status, 'dry-run');
  const saved = await readFile(output, 'utf8');
  assert.equal(JSON.parse(saved).evaluation, null);
  const repeat = run('--dry-run', '--output', output);
  assert.equal(repeat.status, 1);
  assert.doesNotMatch(repeat.stderr, /Record saved successfully/);
  assert.equal(await readFile(output, 'utf8'), saved);
  const bad = run('--dry-run', '--base', 'does-not-exist');
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Fetch the base/);
});

test('shipped Action runs without dependencies and emits valid output records', async t => {
  const repo = await fixture(t);
  await change(repo);
  const output = join(repo, 'action-output.txt');
  await writeFile(output, '');
  const result = spawnSync(process.execPath, [action], { cwd: repo, encoding: 'utf8', windowsHide: true,
    env: { ...process.env, GITHUB_OUTPUT: output, GITHUB_WORKSPACE: repo,
      INPUT_BASE: 'origin/main', INPUT_HEAD: 'HEAD', INPUT_PROVIDER: 'anthropic', 'INPUT_DRY-RUN': 'true' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Record saved to this step's report output/);
  const lines = (await readFile(output, 'utf8')).trim().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]!.slice('report='.length)).status, 'dry-run');
  assert.equal(lines[1], 'audit-status=not-evaluated');
});

// Database variables from the developer's shell must not leak into these checks.
function withoutDatabaseEnv(): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('KEYSTONE_DB_')));
}

test('CLI --include-snapshot adds the committed diff, rules, and context for host applications', async t => {
  const repo = await fixture(t);
  await change(repo);
  const run = (...args: string[]) => spawnSync(process.execPath, [cli, '--repo', repo, ...args], { encoding: 'utf8', windowsHide: true, env: withoutDatabaseEnv() });
  const plain = JSON.parse(run('--dry-run').stdout);
  assert.equal(plain.snapshot, undefined);
  const output = join(repo, 'snapshot-report.json');
  const result = run('--dry-run', '--include-snapshot', '--output', output);
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.equal(data.status, 'dry-run');
  assert.match(data.snapshot.diff, /Welcome everyone/);
  assert.equal(data.snapshot.rules, 'Never remove tests.');
  assert.match(data.snapshot.context['.context/active-task.md'], /Build a welcome/);
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), data);
  // A report file carrying a snapshot is still a valid input for the database mode; only the configuration is missing here.
  const save = run('--save-db', '--input', output, '--label', 'owner/repo');
  assert.equal(save.status, 1);
  assert.match(save.stderr, /Database is not configured/);
  assert.doesNotMatch(save.stderr, /Invalid stored report/);
});

test('CLI database modes validate their inputs before contacting any service', async t => {
  const repo = await fixture(t);
  const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: 'utf8', windowsHide: true, env: withoutDatabaseEnv() });
  const noLabel = run('--history');
  assert.equal(noLabel.status, 1); assert.match(noLabel.stderr, /--label/);
  const unconfigured = run('--history', '--label', 'owner/repo');
  assert.equal(unconfigured.status, 1); assert.match(unconfigured.stderr, /Database is not configured/);
  const noInput = run('--save-db', '--label', 'owner/repo');
  assert.equal(noInput.status, 1); assert.match(noInput.stderr, /--input/);
  await writeFile(join(repo, 'not-a-report.json'), '{"version": 2}');
  const invalid = run('--save-db', '--input', join(repo, 'not-a-report.json'), '--label', 'owner/repo');
  assert.equal(invalid.status, 1); assert.match(invalid.stderr, /Invalid stored report/);
  const unreadable = run('--save-db', '--input', join(repo, 'missing.json'), '--label', 'owner/repo');
  assert.equal(unreadable.status, 1); assert.match(unreadable.stderr, /Cannot read the report file/);
  for (const result of [noLabel, unconfigured, noInput, invalid, unreadable]) assert.equal(result.stdout, '');
});
