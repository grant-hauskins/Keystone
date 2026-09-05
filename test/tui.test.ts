import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { TuiModel, defaultServices, type TuiServices } from '../src/tui/model.js';
import { renderFrame, safeText, textWidth } from '../src/tui/render.js';
import { runSnapshot } from '../src/pipeline.js';
import { fixture, change, snapshot, evaluation, anthropicResponse, git } from './helpers.js';
import type { Report } from '../src/types.js';

function services(overrides: Partial<TuiServices> = {}): TuiServices {
  return {
    ...defaultServices(), cwd: process.cwd(), inspect: async () => structuredClone(snapshot), key: () => 'private-test-key',
    review: (snapshot, options) => runSnapshot(snapshot, { ...options, fetcher: async () => anthropicResponse() }),
    ...overrides,
  };
}
async function edit(model: TuiModel, field: 'repo' | 'base' | 'head' | 'model', value: string): Promise<void> {
  model.edit(field); await model.handle(value, {}); await model.handle('', { name: 'return' });
}
function screen(model: TuiModel, width = 110, height = 32): string {
  return stripVTControlCharacters(renderFrame(model.state, width, height, false).output);
}

test('TUI inspects a real repository without AI and reviews the same snapshot after HEAD moves', async t => {
  const repo = await fixture(t);
  await change(repo);
  let reviewCount = 0;
  const deps = services({ inspect: defaultServices().inspect, review: async (selected, options) => {
    reviewCount++;
    return runSnapshot(selected, { ...options, fetcher: async () => anthropicResponse() });
  } });
  const model = new TuiModel({ repo, model: 'test-model' }, deps);
  await model.inspect();
  assert.equal(model.state.report?.status, 'dry-run');
  assert.equal(reviewCount, 0);
  const inspectedHead = model.state.snapshot!.head;
  await change(repo, 'second.txt', 'Changed after inspection');
  model.requestReview();
  assert.equal(model.state.confirmReview, true);
  assert.equal(reviewCount, 0);
  await model.handle('', { name: 'return' });
  assert.equal(reviewCount, 1);
  assert.equal(model.state.report?.head, inspectedHead);
  assert.notEqual(model.state.report?.head, git(repo, 'rev-parse', 'HEAD'));
  assert.deepEqual(model.state.report?.files, ['welcome.txt']);
  assert.equal(model.state.report?.evaluation?.summary, evaluation.summary);
  assert.equal(git(repo, 'status', '--porcelain'), '');
});

test('repository and revision edits discard stale results, support spaces, and never run shell text', async () => {
  const model = new TuiModel({}, services());
  await model.inspect();
  await edit(model, 'repo', '"C:\\Example Projects\\repo"');
  assert.equal(model.state.repo, resolve('C:\\Example Projects\\repo'));
  assert.equal(model.state.snapshot, null);
  assert.equal(model.state.report, null);
  model.requestReview();
  assert.match(model.state.error!, /Inspect changes first/);
  assert.equal(model.state.confirmReview, false);
  await edit(model, 'base', '99a5f1d');
  assert.equal(model.state.comparison, 'Custom range');
  assert.equal(model.state.base, '99a5f1d');
});

test('missing committed context produces an actionable in-app message', async t => {
  const repo = await fixture(t);
  git(repo, 'rm', '.context/active-task.md'); git(repo, 'commit', '-m', 'Missing task');
  const model = new TuiModel({ repo }, services({ inspect: defaultServices().inspect }));
  await model.inspect();
  assert.match(model.state.error!, /Add a short task description/);
  assert.equal(model.state.busy, null);
  assert.equal(model.state.report, null);
  assert.match(screen(model), /ACTION NEEDED/);
});

test('keys stay out of the screen and missing credentials block only live review', async () => {
  const model = new TuiModel({ model: 'test-model' }, services({ key: () => '' }));
  await model.inspect();
  assert.equal(model.state.report?.status, 'dry-run');
  model.requestReview();
  assert.match(model.state.error!, /ANTHROPIC_API_KEY/);
  assert.equal(model.state.confirmReview, false);
  assert.equal(model.state.editor, null);
  const ready = new TuiModel({}, services());
  assert.doesNotMatch(JSON.stringify(ready.state), /private-test-key/);
  assert.doesNotMatch(screen(ready), /private-test-key/);
});

test('no changes, missing model, and cancelling confirmation do not call the provider', async () => {
  let calls = 0;
  const deps = services({ review: async () => { calls++; throw new Error('Must not run'); } });
  const model = new TuiModel({}, deps);
  await model.inspect(); model.requestReview();
  assert.equal(model.state.editor?.field, 'model');
  await model.handle('test-model', {}); await model.handle('', { name: 'return' });
  model.requestReview(); await model.handle('', { name: 'escape' });
  assert.equal(calls, 0); assert.equal(model.state.confirmReview, false);
  const empty = new TuiModel({ model: 'test-model' }, services({ ...deps, inspect: async () => ({ ...snapshot, files: [], diff: '' }) }));
  await empty.inspect(); empty.requestReview();
  assert.match(empty.state.error!, /no changes to review/);
  assert.equal(calls, 0);
});

test('cancellation aborts a review and late responses cannot replace displayed results', async () => {
  let complete!: (report: Report) => void;
  let signal: AbortSignal | undefined;
  const model = new TuiModel({ model: 'test-model' }, services({ review: async (_snapshot, options) => {
    signal = options.signal;
    return new Promise(resolve => { complete = resolve; });
  } }));
  await model.inspect();
  const original = model.state.report!;
  model.requestReview();
  const pending = model.handle('', { name: 'return' });
  assert.equal(model.state.busy, 'Reviewing with AI');
  await model.handle('', { name: 'escape' });
  assert.equal(signal?.aborted, true);
  complete({ ...original, status: 'evaluated', evaluation });
  await pending;
  assert.equal(model.state.report, original);
  assert.equal(model.state.busy, null);
  assert.match(model.state.notice, /cancelled/);
});

test('cancelled inspections cannot populate a newly selected repository', async () => {
  let complete!: (result: typeof snapshot) => void;
  const model = new TuiModel({}, services({ inspect: async () => new Promise(resolve => { complete = resolve; }) }));
  const pending = model.inspect(); model.cancel();
  await edit(model, 'repo', 'another-repository');
  complete(snapshot); await pending;
  assert.equal(model.state.snapshot, null); assert.equal(model.state.report, null);
});

test('save uses an exclusive JSON write and leaves task context untouched', async t => {
  const repo = await fixture(t);
  await change(repo);
  const model = new TuiModel({ repo }, services({ cwd: repo, inspect: defaultServices().inspect }));
  await model.inspect();
  const contextBefore = await readFile(join(repo, '.context/active-task.md'), 'utf8');
  const path = join(repo, 'report.json');
  model.edit('save'); await model.handle(path, {});
  await model.handle('', { name: 'escape' });
  await assert.rejects(readFile(path), /ENOENT/);
  model.edit('save'); await model.handle(path, {}); await model.handle('', { name: 'return' });
  assert.equal(JSON.parse(await readFile(path, 'utf8')).status, 'dry-run');
  assert.equal(model.state.savedPath, path);
  assert.match(screen(model), /RECORD SAVED SUCCESSFULLY/);
  await writeFile(path, 'keep existing file');
  model.state.tab = 'Diff';
  model.edit('save'); await model.handle(path, {}); await model.handle('', { name: 'return' });
  assert.match(model.state.error!, /already exists/);
  assert.equal(model.state.tab, 'Overview');
  assert.equal(model.state.savedPath, null);
  assert.match(model.state.notice, /not saved/);
  assert.equal(await readFile(path, 'utf8'), 'keep existing file');
  model.edit('save'); await model.handle(join(repo, '.context/active-task.md'), {}); await model.handle('', { name: 'return' });
  assert.match(model.state.error!, /\.json filename/);
  assert.equal(await readFile(join(repo, '.context/active-task.md'), 'utf8'), contextBefore);
});

test('terminal escapes in paths, diffs, and model text cannot reach the terminal', async () => {
  const attack = '\x1b]52;c;clipboard-content\x07\x1b[2Jmalicious\x00\x08';
  assert.equal(safeText(attack), 'malicious');
  const model = new TuiModel({ repo: attack, model: 'test-model' }, services({ inspect: async () => ({ ...snapshot, diff: attack, files: [attack] }) }));
  await model.inspect();
  model.state.report = { ...model.state.report!, status: 'evaluated', evaluation: { ...evaluation, summary: attack, proposedActiveTask: `# Task\n${attack}` } };
  for (const tab of ['Overview', 'Files', 'Diff', 'Task'] as const) {
    model.state.tab = tab;
    const frame = renderFrame(model.state, 110, 32, false).output;
    assert.doesNotMatch(frame, /\x1b\]|\x1b\[2J|\x00|\x08/);
    assert.doesNotMatch(frame, /clipboard-content/);
  }
});

test('quitting during a save waits for its outcome so confirmation is not lost', async () => {
  let finish!: () => void;
  let exited = false;
  const model = new TuiModel({}, services({ save: async () => new Promise<void>(resolve => { finish = resolve; }) }), () => {}, () => { exited = true; });
  await model.inspect(); model.edit('save'); await model.handle('saved-report.json', {});
  const pending = model.handle('', { name: 'return' });
  await model.handle('q', {});
  assert.equal(exited, false);
  finish(); await pending;
  assert.equal(exited, true);
  assert.ok(model.state.savedPath?.endsWith('saved-report.json'));
  assert.match(model.state.notice, /saved successfully/);
});

test('frames fit supported terminal sizes and long documents can be scrolled', async () => {
  const model = new TuiModel({}, services({ inspect: async () => ({ ...snapshot, files: Array.from({ length: 100 }, (_, i) => `folder/文件-${i}.txt`) }) }));
  await model.inspect(); model.state.tab = 'Files';
  for (const [width, height] of [[80, 24], [110, 32], [160, 40]]) {
    const frame = renderFrame(model.state, width!, height!, false);
    const lines = stripVTControlCharacters(frame.output).split('\r\n');
    assert.equal(lines.length, height! - 1);
    assert.ok(lines.every(line => textWidth(line) <= width! - 1));
  }
  await model.handle('', { name: 'pagedown' });
  assert.ok(renderFrame(model.state, 110, 32).scroll > 0);
  assert.match(screen(model, 50, 15), /Enlarge this terminal/);
});

test('keyboard editing, provider selection, help, and quit work without commands', async () => {
  let exited = false;
  const model = new TuiModel({}, services(), () => {}, () => { exited = true; });
  await model.handle('', { name: 'return' });
  assert.equal(model.state.editor?.field, 'repo');
  await model.handle('folder', {}); await model.handle('', { name: 'backspace' });
  assert.equal(model.state.editor?.value, 'folde');
  await model.handle('', { name: 'escape' });
  model.state.selected = 4; await model.handle('', { name: 'return' });
  assert.equal(model.state.provider, 'openai');
  await model.handle('?', {}); assert.match(screen(model), /HOW TO USE KEYSTONE/);
  await model.handle('', { name: 'escape' });
  await model.handle('q', {}); assert.equal(exited, true);
});

test('TUI gives a useful non-interactive error and offers help without a terminal', () => {
  const entry = resolve('build/tui.js');
  const redirected = spawnSync(process.execPath, [entry], { encoding: 'utf8', windowsHide: true });
  assert.equal(redirected.status, 1);
  assert.match(redirected.stderr, /interactive terminal/);
  assert.doesNotMatch(redirected.stderr, /\x1b\[/);
  const help = spawnSync(process.execPath, [entry, '--help'], { encoding: 'utf8', windowsHide: true });
  assert.equal(help.status, 0); assert.match(help.stdout, /interactive terminal/);
});
