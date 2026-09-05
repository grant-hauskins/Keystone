import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/llm.js';
import { validateEvaluation } from '../src/evaluation.js';
import { anthropicResponse, openaiResponse, evaluation, snapshot } from './helpers.js';

test('Anthropic sends a forced structured tool and keeps repository text out of system instructions', async () => {
  let calls = 0;
  const result = await evaluate(snapshot, { provider: 'anthropic', model: 'chosen-model', apiKey: 'test-key', fetcher: async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal(new Headers(init?.headers).get('x-api-key'), 'test-key');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'chosen-model');
    assert.equal(body.tool_choice.name, 'record_evaluation');
    assert.equal(body.tools[0].strict, true);
    assert.ok(!body.system.includes(snapshot.diff));
    assert.ok(body.messages[0].content.includes(snapshot.diff));
    return anthropicResponse();
  } });
  assert.deepEqual(result, evaluation);
  assert.equal(calls, 1);
});

test('OpenAI uses Responses API strict schema and disables response storage', async () => {
  const result = await evaluate(snapshot, { provider: 'openai', model: 'chosen-model', apiKey: 'test-key', fetcher: async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-key');
    return openaiResponse();
  } });
  assert.deepEqual(result, evaluation);
});

test('missing credentials and model fail before sending', async () => {
  await assert.rejects(evaluate(snapshot, { provider: 'anthropic', apiKey: '', model: 'test' }), /ANTHROPIC_API_KEY/);
  await assert.rejects(evaluate(snapshot, { provider: 'openai', apiKey: 'key', model: '' }), /Set a model/);
});

test('provider errors never leak bodies, credentials, or network error contents', async () => {
  for (const fetcher of [
    async () => new Response('secret provider diagnostic', { status: 401 }),
    async () => { throw new Error('test-key'); },
  ]) {
    await assert.rejects(evaluate(snapshot, { provider: 'anthropic', apiKey: 'test-key', model: 'test', fetcher }), error => {
      assert.match(String(error), /Provider request failed/);
      assert.doesNotMatch(String(error), /test-key|secret provider/);
      return true;
    });
  }
});

test('timeout aborts a stalled request', async () => {
  const keeper = setInterval(() => {}, 100);
  try {
    await assert.rejects(evaluate(snapshot, { provider: 'anthropic', apiKey: 'key', model: 'test', timeoutMs: 10,
      fetcher: async (_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('Timed out')), { once: true });
      }),
    }), /Provider request failed/);
  } finally { clearInterval(keeper); }
});

test('truncated and refused responses are rejected', async () => {
  for (const body of [
    { stop_reason: 'max_tokens', content: [] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'No.' }] },
  ]) {
    await assert.rejects(evaluate(snapshot, { provider: 'anthropic', apiKey: 'key', model: 'test', fetcher: async () => Response.json(body) }), /incomplete or refused/);
  }
  await assert.rejects(evaluate(snapshot, { provider: 'openai', apiKey: 'key', model: 'test', fetcher: async () => Response.json({ status: 'incomplete', output: [] }) }), /incomplete or refused/);
  await assert.rejects(evaluate(snapshot, { provider: 'openai', apiKey: 'key', model: 'test', fetcher: async () => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }) }), /refused/);
});

test('invalid JSON and unexpected schema fields are rejected', async () => {
  await assert.rejects(evaluate(snapshot, { provider: 'openai', apiKey: 'key', model: 'test', fetcher: async () => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'not json' }] }] }) }), /invalid JSON/);
  assert.throws(() => validateEvaluation({ ...evaluation, commands: ['run something'] }), /unexpected/);
  assert.throws(() => validateEvaluation({ ...evaluation, summary: '' }), /empty/);
  assert.throws(() => validateEvaluation({ ...evaluation, audit: { status: 'fail', findings: [] } }), /contradicts/);
  assert.throws(() => validateEvaluation({ ...evaluation, audit: { status: 'pass', findings: [{ rule: 'Rule', severity: 'error', explanation: 'Problem', evidence: 'Diff' }] } }), /contradicts/);
});

test('active credential in input or output is rejected', async () => {
  await assert.rejects(evaluate({ ...snapshot, diff: '+test-key' }, { provider: 'anthropic', apiKey: 'test-key', model: 'test' }), /credential/);
  await assert.rejects(evaluate(snapshot, { provider: 'anthropic', apiKey: 'test-key', model: 'test', fetcher: async () => anthropicResponse({ ...evaluation, summary: 'test-key' }) }), /credential/);
});
