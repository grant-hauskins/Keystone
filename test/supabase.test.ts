import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseStore, validateConnection, type ReviewStore } from '../src/storage/supabase.js';
import { TuiModel, defaultServices, menu, type Field } from '../src/tui/model.js';
import { renderFrame } from '../src/tui/render.js';
import { runSnapshot } from '../src/pipeline.js';
import { snapshot } from './helpers.js';

const connection = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_example' };
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function signIn(store: SupabaseStore) { store.useConnection(connection); await store.verifyCode('test@example.invalid', '123456'); }
const authResponse = () => Response.json({ access_token: 'private-session-token', expires_in: 3600 });

test('database connection rejects secret keys, credentials in URLs, and off-provider destinations', () => {
  for (const url of ['http://example.supabase.co', 'https://evil.invalid', 'https://example.supabase.co/path', 'https://user:pass@example.supabase.co', 'https://example.supabase.co?token=x']) {
    assert.throws(() => validateConnection({ ...connection, url }));
  }
  assert.throws(() => validateConnection({ ...connection, publishableKey: 'sb_secret_bad' }));
  assert.deepEqual(validateConnection(connection), connection);
});

test('email authentication uses no user token before verification; sign-out prevents storage requests', async () => {
  const calls: { path: string; init: RequestInit }[] = [];
  const store = new SupabaseStore('.', async (url, init) => {
    calls.push({ path: String(url), init: init! });
    return String(url).endsWith('/verify') ? authResponse() : Response.json({});
  });
  store.useConnection(connection);
  await store.sendCode('test@example.invalid'); await store.verifyCode('test@example.invalid', '123456');
  assert.equal(new Headers(calls[0]!.init.headers).get('Authorization'), null);
  assert.equal(JSON.parse(String(calls[0]!.init.body)).email, 'test@example.invalid');
  assert.equal(JSON.parse(String(calls[1]!.init.body)).type, 'email');
  store.signOut();
  await assert.rejects(store.history('demo'), /Sign in/);
  assert.equal(calls.length, 2);
});

test('failed auth does not expose server response or establish a session', async () => {
  const store = new SupabaseStore('.', async () => new Response('private-session-token', { status: 403 }));
  store.useConnection(connection);
  await assert.rejects(store.verifyCode('a@b.invalid', '123'), error => error instanceof Error && !error.message.includes('private-session-token'));
  await assert.rejects(store.history('demo'), /Sign in/);
});

test('save confirms its exact ID; retries verify an identical existing report without overwriting it', async () => {
  const report = await runSnapshot(snapshot, { dryRun: true });
  let writes = 0;
  const store = new SupabaseStore('.', async (url, init) => {
    if (String(url).includes('/verify')) return authResponse();
    assert.equal(new Headers(init!.headers).get('Authorization'), 'Bearer private-session-token');
    if (init!.method === 'POST') {
      writes++;
      const payload = JSON.parse(String(init!.body));
      assert.equal(payload.owner_id, undefined);
      assert.equal(payload.report.diff, undefined);
      return writes === 1 ? Response.json([{ id }]) : new Response('', { status: 409 });
    }
    return Response.json([{ id, repository: 'owner/repo', report }]);
  });
  await signIn(store);
  assert.equal(await store.save(id, 'owner/repo', report), id);
  assert.equal(await store.save(id, 'owner/repo', report), id);
  await assert.rejects(store.save(id, 'another/repo', report), /conflict/);
});

test('unacknowledged save and invalid history are errors, and remote messages are not echoed', async () => {
  const report = await runSnapshot(snapshot, { dryRun: true });
  const store = new SupabaseStore('.', async url => String(url).includes('/verify') ? authResponse() : Response.json([]));
  await signIn(store);
  await assert.rejects(store.save(id, 'demo', report), /acknowledge/);
  const broken = new SupabaseStore('.', async url => String(url).includes('/verify') ? authResponse() : Response.json([{ report: {} }]));
  await signIn(broken);
  await assert.rejects(broken.history('demo'), /invalid history/);
});

function database(overrides: Partial<ReviewStore> = {}): ReviewStore {
  return { configure: async () => {}, sendCode: async () => {}, verifyCode: async () => {}, signInPassword: async () => {}, signOut: () => {}, save: async id => id, history: async () => [], ...overrides };
}
function model(db: ReviewStore) { return new TuiModel({}, { ...defaultServices(), database: db, inspect: async () => structuredClone(snapshot) }); }
async function edit(tui: TuiModel, field: Field, value: string) { tui.edit(field); await tui.handle(value); await tui.handle('', { name: 'return' }); }

test('TUI confirms after database acknowledgement, retains ID on uncertain retries, and keeps inspection while loading history', async () => {
  const ids: string[] = []; let attempt = 0;
  const tui = model(database({ save: async id => { ids.push(id); if (attempt++ === 0) throw new Error('Network interrupted'); return id; } }));
  await tui.inspect();
  await tui.saveDatabase(); assert.equal(tui.state.databaseSavedId, null);
  assert.match(tui.state.error!, /Network interrupted/);
  await tui.saveDatabase(); assert.equal(ids[0], ids[1]);
  assert.equal(tui.state.databaseSavedId, ids[1]);
  assert.match(tui.state.notice, /Record saved successfully to Supabase/);
  const inspected = tui.state.snapshot;
  await tui.loadHistory(); assert.equal(tui.state.snapshot, inspected);
  await edit(tui, 'repositoryLabel', 'owner/other');
  await tui.saveDatabase(); assert.notEqual(ids[2], ids[1]);
});

test('TUI hides the sign-in code and clears it after submission; database menu remains reachable in a small terminal', async () => {
  const tui = model(database());
  await edit(tui, 'email', 'test@example.invalid');
  tui.edit('code'); await tui.handle('123456');
  assert.doesNotMatch(renderFrame(tui.state, 110, 32, false).output, /123456/);
  await tui.handle('', { name: 'return' });
  assert.equal(tui.state.editor, null); assert.equal(tui.state.code, '');
  assert.equal(tui.state.databaseStatus, 'Signed in');
  tui.state.selected = menu.indexOf('Sign out');
  assert.match(renderFrame(tui.state, 76, 22, false).output, /> Sign out/);
});

test('quit waits for a database write and reports its outcome before exiting', async () => {
  let finish!: () => void; let exited = false;
  const wait = new Promise<void>(resolve => { finish = resolve; });
  const tui = new TuiModel({}, { ...defaultServices(), inspect: async () => snapshot,
    database: database({ save: async id => { await wait; return id; } }),
  }, () => {}, () => { exited = true; });
  await tui.inspect(); const saving = tui.saveDatabase(); tui.close();
  assert.equal(exited, false); finish(); await saving;
  assert.equal(exited, true); assert.ok(tui.state.databaseSavedId);
});

test('password login uses the user auth endpoint without emailing, and failed login clears access', async () => {
  let requests = 0;
  const store = new SupabaseStore('.', async (url, init) => {
    assert.match(String(url), /\/auth\/v1\/token\?grant_type=password$/);
    assert.equal(new Headers(init!.headers).get('Authorization'), null);
    assert.equal(JSON.parse(String(init!.body)).password, ' test password ');
    return requests++ === 0 ? authResponse() : new Response('private detail', { status: 400 });
  });
  store.useConnection(connection);
  await store.signInPassword('a@b.invalid', ' test password ');
  await assert.rejects(store.signInPassword('a@b.invalid', ' test password '), /not accepted/);
  await assert.rejects(store.history('demo'), /Sign in/);
});

test('password input is masked, preserves whitespace, and is discarded after submission', async () => {
  let received = '';
  const tui = model(database({ signInPassword: async (_email, password) => { received = password; } }));
  await edit(tui, 'passwordEmail', 'a@b.invalid');
  assert.equal(tui.state.editor?.field, 'password');
  await tui.handle(' private password ');
  assert.doesNotMatch(renderFrame(tui.state, 110, 32, false).output, /private password/);
  await tui.handle('', { name: 'return' });
  assert.equal(received, ' private password ');
  assert.equal(tui.state.password, ''); assert.equal(tui.state.editor, null);
  assert.doesNotMatch(JSON.stringify(tui.state), /private password/);
  assert.equal(tui.state.databaseStatus, 'Signed in');
});
