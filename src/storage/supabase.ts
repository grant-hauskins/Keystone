import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { Report } from '../types.js';
import { validateEvaluation } from '../evaluation.js';

export interface Connection { url: string; publishableKey: string }
export interface StoredReview { id: string; repository: string; created_at: string; report: Report }
export interface ReviewStore {
  configure(connection: Connection): Promise<void>;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signInPassword(email: string, password: string): Promise<void>;
  signOut(): void;
  save(id: string, repository: string, report: Report): Promise<string>;
  history(repository: string): Promise<StoredReview[]>;
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new Error('Database returned an unreadable response. Retry the request.'); }
}

function validateReport(value: unknown): Report {
  const r = value as Report;
  const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(s => typeof s === 'string');
  if (!r || r.version !== 1 || !['evaluated', 'dry-run', 'no-changes'].includes(r.status)
    || ![r.base, r.head, r.mergeBase, r.rulesSource].every(s => typeof s === 'string' && /^[0-9a-f]{40,64}$/.test(s))
    || !strings(r.files) || !strings(r.contextFiles) || !strings(r.warnings)
    || !Number.isFinite(r.diffBytes) || r.diffBytes < 0
    || ![null, 'anthropic', 'openai'].includes(r.provider) || (r.model !== null && typeof r.model !== 'string')
    || (r.status === 'evaluated') !== (r.evaluation !== null)) throw new Error('Invalid stored report.');
  return { version: 1, status: r.status, base: r.base, head: r.head, mergeBase: r.mergeBase,
    rulesSource: r.rulesSource, files: r.files, contextFiles: r.contextFiles, warnings: r.warnings,
    diffBytes: r.diffBytes, provider: r.provider, model: r.model,
    evaluation: r.evaluation === null ? null : validateEvaluation(r.evaluation) };
}

export function validateConnection(connection: Connection): Connection {
  const url = new URL(connection.url.trim());
  if (url.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname)
    || url.username || url.password || url.port || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Use your hosted Project URL: https://your-project.supabase.co');
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(connection.publishableKey.trim())) {
    throw new Error('Use a Supabase publishable key, never a secret or service_role key.');
  }
  return { url: url.origin, publishableKey: connection.publishableKey.trim() };
}

export async function loadConnection(cwd: string): Promise<Connection | null> {
  try { return validateConnection(JSON.parse(await readFile(resolve(cwd, '.keystone-supabase.json'), 'utf8'))); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new Error('Invalid .keystone-supabase.json. It must contain url and publishableKey only.');
  }
}

// Uses Supabase Auth and PostgREST HTTP APIs. Access tokens live only in memory.
export class SupabaseStore implements ReviewStore {
  private connection: Connection | null = null;
  private session: { token: string; expires: number } | null = null;
  constructor(private cwd: string, private fetcher: typeof fetch = fetch) {}

  useConnection(connection: Connection): void { this.connection = validateConnection(connection); this.signOut(); }
  async configure(connection: Connection): Promise<void> {
    this.connection = null; this.signOut();
    const checked = validateConnection(connection);
    await writeFile(resolve(this.cwd, '.keystone-supabase.json'), JSON.stringify(checked, null, 2) + '\n', { mode: 0o600 });
    this.useConnection(checked);
  }
  signOut(): void { this.session = null; }

  private async request(path: string, method = 'GET', body?: unknown, authenticated = true): Promise<Response> {
    if (!this.connection) throw new Error('Configure the Database URL and publishable key first.');
    if (authenticated && (!this.session || Date.now() >= this.session.expires)) {
      this.signOut(); throw new Error('Sign in to the database again; your session is missing or expired.');
    }
    let response: Response;
    try {
      response = await this.fetcher(this.connection.url + path, {
        method, redirect: 'error', signal: AbortSignal.timeout(20_000),
        headers: { apikey: this.connection.publishableKey, 'Content-Type': 'application/json',
          ...(authenticated ? { Authorization: `Bearer ${this.session!.token}` } : {}),
          ...(method === 'POST' && authenticated ? { Prefer: 'return=representation' } : {}),
        }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { throw new Error('Database connection interrupted. For a save, retry without changing the report to check the same record ID.'); }
    if (response.status === 401) { this.signOut(); throw new Error('Database sign-in failed or expired. Check the project key and sign in again.'); }
    return response;
  }

  async sendCode(email: string): Promise<void> {
    this.signOut();
    const response = await this.request('/auth/v1/otp', 'POST', { email, create_user: true }, false);
    if (!response.ok) throw new Error(`Could not request a sign-in code (HTTP ${response.status}). Check email authentication and email delivery settings.`);
  }
  async verifyCode(email: string, code: string): Promise<void> {
    this.signOut();
    const response = await this.request('/auth/v1/verify', 'POST', { email, token: code, type: 'email' }, false);
    if (!response.ok) throw new Error('That sign-in code was not accepted. Check the code or request a new one.');
    await this.acceptSession(response);
  }
  async signInPassword(email: string, password: string): Promise<void> {
    this.signOut();
    const response = await this.request('/auth/v1/token?grant_type=password', 'POST', { email, password }, false);
    if (!response.ok) throw new Error('Sign-in was not accepted. Use the confirmed user created in this project and its Keystone password.');
    await this.acceptSession(response);
  }
  private async acceptSession(response: Response): Promise<void> {
    const data = await readJson(response) as { access_token?: unknown; expires_in?: unknown };
    if (!data || typeof data.access_token !== 'string' || !data.access_token || typeof data.expires_in !== 'number' || !Number.isFinite(data.expires_in) || data.expires_in <= 5) {
      throw new Error('Database returned an invalid sign-in session.');
    }
    this.session = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 - 5000 };
  }
  async save(id: string, repository: string, report: Report): Promise<string> {
    if (!/^[0-9a-f-]{36}$/.test(id) || !repository.trim() || repository.length > 300) throw new Error('Invalid record ID or repository label.');
    const response = await this.request('/rest/v1/keystone_reviews', 'POST', {
      id, repository, base_sha: report.base, head_sha: report.head, report,
    });
    if (response.status === 409) {
      const existing = await this.request(`/rest/v1/keystone_reviews?id=eq.${encodeURIComponent(id)}&select=id,repository,report`);
      if (!existing.ok) throw new Error('Could not verify the earlier save. Retry after checking database access.');
      const rows = await readJson(existing) as StoredReview[];
      if (Array.isArray(rows) && rows.length === 1 && rows[0]?.id === id && rows[0].repository === repository && isDeepStrictEqual(rows[0].report, report)) return id;
      throw new Error('Record ID conflict. The existing record does not match this report.');
    }
    if (!response.ok) throw new Error(`Database save was not confirmed (HTTP ${response.status}). Check that the migration and access policies are installed.`);
    const rows = await readJson(response) as StoredReview[];
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.id !== id) throw new Error('Database did not acknowledge this record. Retry to verify the same ID.');
    return id;
  }
  async history(repository: string): Promise<StoredReview[]> {
    const query = new URLSearchParams({ select: 'id,repository,created_at,report', repository: `eq.${repository}`, order: 'created_at.desc', limit: '20' });
    const response = await this.request('/rest/v1/keystone_reviews?' + query);
    if (!response.ok) throw new Error(`Could not load history (HTTP ${response.status}). Check the migration and access policies.`);
    const rows: unknown = await readJson(response);
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row.id !== 'string' || typeof row.created_at !== 'string' || row.repository !== repository || row.report?.version !== 1)) {
      throw new Error('Database returned invalid history records.');
    }
    try { return rows.map(row => ({ id: row.id, repository: row.repository, created_at: row.created_at, report: validateReport(row.report) })); }
    catch { throw new Error('Database returned invalid history records.'); }
  }
}
