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
  assert.equal(JSON.parse(result.stdout).status, 'dry-run');
  const saved = await readFile(output, 'utf8');
  assert.equal(JSON.parse(saved).evaluation, null);
  const repeat = run('--dry-run', '--output', output);
  assert.equal(repeat.status, 1);
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
  const lines = (await readFile(output, 'utf8')).trim().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]!.slice('report='.length)).status, 'dry-run');
  assert.equal(lines[1], 'audit-status=not-evaluated');
});
