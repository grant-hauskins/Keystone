import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { AgentSession } from '../src/mcp/service.js';
import { runSnapshot } from '../src/pipeline.js';
import { snapshot, anthropicResponse, fixture, change, git } from './helpers.js';

test('MCP service pins inspected commits, separates reviewed results, and reuses database IDs on retries', async () => {
  const writes: string[] = [];
  const session = new AgentSession('configured-repo', 'owner/repo', {
    inspect: async repo => { assert.equal(repo, 'configured-repo'); return structuredClone(snapshot); },
    run: (snapshot, options) => runSnapshot(snapshot, { ...options, fetcher: async () => anthropicResponse() }),
    key: () => 'private-test-key',
    database: { save: async (id, label, report) => {
      assert.equal(label, 'owner/repo'); assert.equal(report.head, snapshot.head);
      writes.push(id); if (writes.length === 1) throw new Error('Network interrupted'); return id;
    }, history: async () => [] },
  });
  const inspection = await session.inspect();
  const review = await session.review(inspection.resultId, 'anthropic', 'test-model');
  assert.notEqual(review.resultId, inspection.resultId);
  assert.equal(inspection.report.status, 'dry-run'); assert.equal(review.report.status, 'evaluated');
  await assert.rejects(session.save(review.resultId), /interrupted/);
  const saved = await session.save(review.resultId);
  assert.equal(writes[0], writes[1]); assert.equal(saved.recordId, writes[0]);
  assert.match(saved.message, /Record saved successfully/);
});

test('MCP refuses unknown result IDs and unconfigured database operations', async () => {
  const session = new AgentSession('repo', 'owner/repo', { inspect: async () => snapshot, run: runSnapshot, key: () => '' });
  await assert.rejects(session.save('invented'), /Unknown/);
  const result = await session.inspect();
  await assert.rejects(session.save(result.resultId), /not configured/);
  await assert.rejects(session.history(), /not configured/);
  await assert.rejects(session.review(result.resultId, 'anthropic', 'model'), /Missing ANTHROPIC_API_KEY/);
});

test('real MCP stdio client discovers tools, inspects a Git repository, and receives tool errors without writes', async t => {
  const repo = await fixture(t); await change(repo);
  const transport = new StdioClientTransport({
    command: process.execPath, args: [resolve('build/mcp.js'), '--repo', repo, '--label', 'test/repo', '--config-dir', repo],
    stderr: 'pipe', env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? 'C:\\Windows' },
  });
  const client = new Client({ name: 'keystone-test', version: '1.0.0' });
  t.after(async () => { await client.close(); });
  await client.connect(transport);
  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map(tool => tool.name).sort(), ['keystone_history', 'keystone_inspect', 'keystone_review', 'keystone_save_record']);
  const result = await client.callTool({ name: 'keystone_inspect', arguments: {} });
  assert.ok('content' in result && Array.isArray(result.content));
  const first = result.content[0];
  assert.equal(first?.type, 'text');
  const data = JSON.parse((first as { text: string }).text);
  assert.equal(data.report.head, git(repo, 'rev-parse', 'HEAD'));
  assert.equal(data.report.status, 'dry-run');
  const error = await client.callTool({ name: 'keystone_save_record', arguments: { resultId: data.resultId } });
  assert.equal(error.isError, true);
  const badArgs = await client.callTool({ name: 'keystone_inspect', arguments: { repo: 'another-folder' } });
  assert.equal(badArgs.isError, true);
  assert.equal(git(repo, 'status', '--porcelain'), '');
});
