import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import type { TestContext } from 'node:test';
import type { Evaluation, Snapshot } from '../src/types.js';

export function git(repo: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Keystone Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args], {
    cwd: repo, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
export async function fixture(t: TestContext): Promise<string> {
  const repo = await mkdtemp(join(tmpdir(), 'keystone-test-'));
  t.after(async () => {
    if (dirname(resolve(repo)) !== resolve(tmpdir()) || !repo.includes('keystone-test-')) throw new Error('Unexpected test cleanup path.');
    await rm(repo, { recursive: true, force: true });
  });
  git(repo, 'init', '-b', 'main');
  await mkdir(join(repo, '.context'));
  await writeFile(join(repo, 'CLAUDE.md'), 'Never remove tests.');
  await writeFile(join(repo, '.context/active-task.md'), '# Task\nBuild a welcome message.');
  await writeFile(join(repo, 'welcome.txt'), 'Hello\n');
  git(repo, 'add', '.'); git(repo, 'commit', '-m', 'Initial fixture');
  git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  return repo;
}
export async function change(repo: string, path = 'welcome.txt', content = 'Welcome everyone\n'): Promise<void> {
  await writeFile(join(repo, path), content);
  git(repo, 'add', '.'); git(repo, 'commit', '-m', 'Update fixture');
}

export const evaluation: Evaluation = {
  summary: 'Visitors now see a clearer welcome message.', changes: ['The greeting welcomes everyone.'],
  audit: { status: 'pass', findings: [] }, proposedActiveTask: '# Task\nGreeting updated; human review remains.',
};
export const snapshot: Snapshot = {
  base: 'a'.repeat(40), head: 'b'.repeat(40), mergeBase: 'a'.repeat(40), rulesSource: 'a'.repeat(40),
  rules: 'Use plain English.', context: { '.context/active-task.md': '# Task' },
  diff: '+Welcome everyone', files: ['welcome.txt'], warnings: [],
};
export function anthropicResponse(value: unknown = evaluation): Response {
  return Response.json({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'record_evaluation', input: value }] });
}
export function openaiResponse(value: unknown = evaluation): Response {
  return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });
}
