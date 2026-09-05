import { writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Connection, ReviewStore, StoredReview } from '../storage/supabase.js';
import type { Key } from 'node:readline';
import { collectSnapshot } from '../git.js';
import { runSnapshot } from '../pipeline.js';
import type { LlmOptions } from '../llm.js';
import type { Provider, Report, Snapshot } from '../types.js';

export type Tab = 'Overview' | 'Files' | 'Diff' | 'Findings' | 'Task' | 'History';
export const tabs: Tab[] = ['Overview', 'Files', 'Diff', 'Findings', 'Task', 'History'];
export const menu = ['Repository', 'Comparison', 'Base revision', 'Head revision', 'AI provider', 'AI API key', 'Model', 'Inspect changes', 'Run AI review', 'Save report', 'Database URL', 'Database key', 'Email sign-in', 'Enter sign-in code', 'Repository label', 'Save to database', 'Load history', 'Sign out', 'Password sign-in'];
export type Field = 'apiKey' | 'repo' | 'base' | 'head' | 'model' | 'save' | 'databaseUrl' | 'databaseKey' | 'email' | 'code' | 'repositoryLabel' | 'passwordEmail' | 'password';
export interface Editor { field: Field; value: string; cursor: number; replace: boolean }
export interface TuiState {
  databaseUrl: string;
  databaseKey: string;
  email: string;
  code: string;
  passwordEmail: string;
  password: string;
  repositoryLabel: string;
  databaseStatus: string;
  databaseSavedId: string | null;
  history: StoredReview[];
  repo: string;
  base: string;
  head: string;
  comparison: 'Latest commit' | 'Branch changes' | 'Custom range';
  provider: Provider;
  models: Record<Provider, string>;
  credentialReady: boolean;
  credentialSource: 'session' | 'environment' | 'missing';
  selected: number;
  tab: Tab;
  scroll: number;
  snapshot: Snapshot | null;
  report: Report | null;
  busy: 'Inspecting repository' | 'Reviewing with AI' | 'Saving report' | 'Database request' | null;
  editor: Editor | null;
  confirmReview: boolean;
  savedPath: string | null;
  help: boolean;
  notice: string;
  error: string | null;
}
export interface TuiOptions {
  connection?: Connection | null;
  repo?: string;
  base?: string;
  head?: string;
  provider?: Provider;
  model?: string;
}
export interface TuiServices {
  database?: ReviewStore;
  inspect: (repo: string, base: string, head: string) => Promise<Snapshot>;
  review: (snapshot: Snapshot, options: LlmOptions) => Promise<Report>;
  save: (path: string, report: Report) => Promise<void>;
  key: (provider: Provider) => string;
  cwd: string;
}
export function defaultServices(): TuiServices {
  return {
    inspect: collectSnapshot,
    review: (snapshot, options) => runSnapshot(snapshot, options),
    save: (path, report) => writeFile(path, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 }),
    key: provider => process.env[provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'] ?? '',
    cwd: process.cwd(),
  };
}

export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Something went wrong. Try inspecting the repository again.';
  if (/Missing committed \.context\/active-task.md/.test(message)) return 'The selected commit has no .context/active-task.md. Add a short task description to that file, commit it in this repository, then inspect again.';
  if (/Missing committed CLAUDE.md/.test(message)) return 'The repository needs a committed CLAUDE.md containing its project rules. Add and commit it, then inspect again.';
  if (/Cannot resolve a commit/.test(message)) return 'That comparison is unavailable. Check the repository path and revisions. Latest commit needs at least two commits; Branch changes needs a fetched origin/main. You can enter a custom base.';
  if (typeof error === 'object' && error && 'code' in error) {
    if (error.code === 'EEXIST') return 'That report file already exists. Choose a different name; nothing was overwritten.';
    if (error.code === 'ENOENT') return 'That output folder does not exist. Choose an existing folder for your report.';
    if (error.code === 'EACCES' || error.code === 'EPERM') return 'Cannot write there. Choose a folder you have permission to use.';
  }
  return message;
}

export class TuiModel {
  readonly state: TuiState;
  #sessionKeys: Partial<Record<Provider, string>> = {};
  private activeKey(): string { return this.#sessionKeys[this.state.provider] ?? this.services.key(this.state.provider); }
  private refreshCredential(): void {
    this.state.credentialReady = Boolean(this.activeKey().trim());
    this.state.credentialSource = this.#sessionKeys[this.state.provider] ? 'session' : this.state.credentialReady ? 'environment' : 'missing';
  }
  private pendingRecord: { report: Report; repository: string; id: string } | null = null;
  private operation = 0;
  private abort: AbortController | null = null;
  private closed = false;
  private closeRequested = false;

  constructor(options: TuiOptions, private services: TuiServices = defaultServices(), private changed: () => void = () => {}, private exit: () => void = () => {}) {
    const provider = options.provider ?? 'anthropic';
    this.state = {
      databaseUrl: options.connection?.url ?? '', databaseKey: options.connection?.publishableKey ?? '',
      email: '', code: '', passwordEmail: '', password: '', repositoryLabel: basename(options.repo ?? services.cwd),
      databaseStatus: options.connection ? 'Configured; choose a sign-in method' : 'Not configured',
      databaseSavedId: null, history: [],
      repo: options.repo ?? services.cwd, base: options.base ?? 'HEAD~1', head: options.head ?? 'HEAD',
      comparison: options.base || options.head ? 'Custom range' : 'Latest commit', provider,
      models: { anthropic: '', openai: '', [provider]: options.model ?? '' },
      credentialReady: Boolean(services.key(provider).trim()),
      credentialSource: services.key(provider).trim() ? 'environment' : 'missing',
      selected: 0, tab: 'Overview', scroll: 0, snapshot: null, report: null, busy: null,
      editor: null, confirmReview: false, savedPath: null, help: false, error: null,
      notice: 'Choose a repository, then inspect its committed changes. No AI call is made during inspection.',
    };
  }

  private refresh(): void { if (!this.closed) this.changed(); }
  private fail(message: string): void { this.state.error = message; this.state.tab = 'Overview'; this.state.scroll = 0; this.refresh(); }
  private invalidate(): void {
    this.state.snapshot = null; this.state.report = null; this.state.error = null;
    this.state.databaseSavedId = null; this.state.history = []; this.pendingRecord = null;
    this.state.savedPath = null;
    this.state.tab = 'Overview'; this.state.scroll = 0;
    this.state.notice = 'Settings changed. Inspect again to load the selected commits.';
  }

  edit(field: Field): void {
    if (this.state.busy) return;
    const value = field === 'apiKey' ? '' : field === 'save' ? resolve(this.services.cwd, `keystone-report-${Date.now()}.json`)
      : field === 'model' ? this.state.models[this.state.provider] : this.state[field];
    this.state.editor = { field, value, cursor: value.length, replace: true };
    this.refresh();
  }

  private async finishEdit(): Promise<void> {
    const editor = this.state.editor!;
    // Pasted Windows paths often arrive wrapped in quotes. They are data, never shell commands.
    const value = editor.field === 'password' ? editor.value : editor.value.trim().replace(/^"(.*)"$/, '$1');
    if (!value && editor.field !== 'apiKey') { this.state.notice = 'Please enter a value, or press Esc to cancel.'; this.refresh(); return; }
    this.state.editor = null;
    if (editor.field === 'apiKey') {
      if (value) this.#sessionKeys[this.state.provider] = value;
      else delete this.#sessionKeys[this.state.provider];
      this.refreshCredential(); this.state.error = null;
      this.state.notice = value ? 'API key set for ' + this.state.provider + ' for this session. It has not been tested or saved to disk.' : 'Session key cleared. Using the terminal key if available.';
      this.refresh(); return;
    }
    if (['databaseUrl', 'databaseKey', 'email', 'code', 'repositoryLabel', 'passwordEmail', 'password'].includes(editor.field)) {
      await this.finishDatabaseEdit(editor.field, value); return;
    }
    if (editor.field === 'save') { await this.save(value); return; }
    if (editor.field === 'model') {
      this.state.models[this.state.provider] = value;
      this.state.notice = 'Model selected. The inspected commits are unchanged.';
    } else {
      if (editor.field !== 'repo' && editor.field !== 'base' && editor.field !== 'head') return;
      this.state[editor.field] = editor.field === 'repo' ? resolve(this.services.cwd, value) : value;
      if (editor.field === 'repo') this.state.repositoryLabel = basename(this.state.repo);
      if (editor.field === 'base' || editor.field === 'head') this.state.comparison = 'Custom range';
      this.invalidate();
    }
    this.refresh();
  }

  private async databaseOperation(action: () => Promise<void>): Promise<void> {
    if (this.state.busy) return;
    if (!this.services.database) { this.fail('Database storage is unavailable.'); return; }
    this.state.busy = 'Database request'; this.state.error = null; this.state.notice = 'Contacting Supabase...'; this.refresh();
    try { await action(); }
    catch (error) {
      this.state.notice = 'Database request was not confirmed. See the error for the next step.';
      const message = error instanceof Error ? error.message : 'Database request failed.';
      if (/sign.in|session/i.test(message)) this.state.databaseStatus = 'Sign in required';
      this.fail(message);
    }
    finally {
      this.state.busy = null; this.refresh();
      if (this.closeRequested) this.close();
    }
  }

  private async finishDatabaseEdit(field: Field, value: string): Promise<void> {
    if (field === 'passwordEmail') {
      this.state.email = value; this.state.passwordEmail = value;
      this.edit('password'); return;
    }
    if (field === 'repositoryLabel') {
      if (value.length > 300) { this.fail('Use a repository label under 300 characters.'); return; }
      this.state.repositoryLabel = value; this.state.history = []; this.state.databaseSavedId = null; this.pendingRecord = null;
      this.state.notice = 'Repository label selected. Use the same owner/repository label on every computer.'; this.refresh(); return;
    }
    await this.databaseOperation(async () => {
      const db = this.services.database!;
      if (field === 'databaseUrl' || field === 'databaseKey') {
        this.state[field] = value; db.signOut(); this.state.history = []; this.state.databaseSavedId = null;
        this.state.databaseStatus = 'Not signed in'; this.pendingRecord = null;
        if (this.state.databaseUrl && this.state.databaseKey) {
          await db.configure({ url: this.state.databaseUrl, publishableKey: this.state.databaseKey });
          this.state.databaseStatus = 'Configured; choose a sign-in method';
          this.state.notice = 'Connection settings saved locally. Choose Password sign-in, or Email sign-in if code delivery is configured.';
        } else this.state.notice = 'Enter the other database connection setting to finish setup.';
      } else if (field === 'email') {
        this.state.email = value; this.state.databaseStatus = 'Not signed in'; this.state.history = [];
        await db.sendCode(value);
        this.state.databaseStatus = 'Code requested; check your email';
        this.state.notice = 'Sign-in code requested. Choose Enter sign-in code. Delivery depends on Supabase email settings.';
      } else if (field === 'password') {
        await db.signInPassword(this.state.email, value);
        this.state.history = []; this.state.databaseStatus = 'Signed in';
        this.state.notice = 'Signed in. No email service was needed. You can save records and load history.';
      } else if (field === 'code') {
        if (!this.state.email) throw new Error('Choose Email sign-in first.');
        await db.verifyCode(this.state.email, value);
        this.state.databaseStatus = 'Signed in'; this.state.notice = 'Signed in. You can save records and load history.';
      }
    });
  }

  async saveDatabase(): Promise<void> {
    if (!this.state.report || this.state.busy) { this.fail('Inspect changes before saving to the database.'); return; }
    const report = this.state.report;
    const repository = this.state.repositoryLabel;
    if (!this.pendingRecord || this.pendingRecord.report !== report || this.pendingRecord.repository !== repository) {
      this.pendingRecord = { report, repository, id: randomUUID() };
    }
    const id = this.pendingRecord.id;
    this.state.databaseSavedId = null;
    await this.databaseOperation(async () => {
      const saved = await this.services.database!.save(id, repository, report);
      this.state.databaseSavedId = saved; this.state.tab = 'Overview'; this.state.scroll = 0;
      this.state.notice = 'Record saved successfully to Supabase: ' + saved;
    });
  }

  async loadHistory(): Promise<void> {
    this.state.history = [];
    await this.databaseOperation(async () => {
      this.state.history = await this.services.database!.history(this.state.repositoryLabel);
      this.state.tab = 'History'; this.state.scroll = 0;
      this.state.notice = 'Loaded the latest 20 records for this repository label. The inspected snapshot is unchanged.';
    });
  }

  async inspect(): Promise<void> {
    if (this.state.busy) return;
    const operation = ++this.operation;
    this.state.busy = 'Inspecting repository'; this.state.error = null;
    this.state.databaseSavedId = null; this.pendingRecord = null;
    this.state.snapshot = null; this.state.report = null; this.state.tab = 'Overview'; this.state.scroll = 0;
    this.state.savedPath = null;
    this.refresh();
    try {
      const snapshot = await this.services.inspect(this.state.repo, this.state.base, this.state.head);
      const report = await runSnapshot(snapshot, { dryRun: true });
      if (this.operation !== operation || this.closed) return;
      this.state.snapshot = snapshot; this.state.report = report;
      this.state.notice = snapshot.diff ? `Inspection ready: ${snapshot.files.length} changed files. No AI review has run.` : 'No changes in this comparison. Choose another base revision to review more commits.';
      this.state.selected = menu.indexOf('Run AI review');
    } catch (error) {
      if (this.operation === operation && !this.closed) this.state.error = friendlyError(error);
    } finally {
      if (this.operation === operation) { this.state.busy = null; this.refresh(); }
    }
  }

  requestReview(): void {
    if (this.state.busy) return;
    if (!this.state.snapshot) { this.fail('Inspect changes first so you can see which commits will be reviewed.'); return; }
    if (!this.state.snapshot.diff) { this.fail('There are no changes to review. Choose another comparison and inspect again.'); return; }
    this.refreshCredential();
    if (!this.state.credentialReady) {
      const name = this.state.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
      this.fail(`No ${name} is available. Choose AI API key and paste it there. Inspection works without it. Never paste an API key into the model field.`); return;
    }
    if (!this.state.models[this.state.provider].trim()) { this.edit('model'); this.state.notice = 'Enter a model ID available in your provider account, then choose Run AI review.'; this.refresh(); return; }
    this.state.confirmReview = true; this.refresh();
  }

  private async review(): Promise<void> {
    if (!this.state.snapshot || this.state.busy) return;
    const operation = ++this.operation;
    const snapshot = this.state.snapshot;
    this.abort = new AbortController();
    this.state.busy = 'Reviewing with AI'; this.state.error = null; this.state.tab = 'Overview'; this.state.scroll = 0;
    this.refresh();
    try {
      const report = await this.services.review(snapshot, {
        provider: this.state.provider, model: this.state.models[this.state.provider],
        apiKey: this.activeKey(), signal: this.abort.signal,
      });
      if (this.operation !== operation || this.closed) return;
      this.state.report = report; this.state.databaseSavedId = null; this.pendingRecord = null;
      this.state.notice = 'Review complete. Read the findings and proposed task before using them. Your repository has not been edited.';
    } catch (error) {
      if (this.operation === operation && !this.closed) this.state.error = friendlyError(error);
    } finally {
      if (this.operation === operation) { this.state.busy = null; this.abort = null; this.refresh(); }
    }
  }

  private async save(path: string): Promise<void> {
    if (!this.state.report || this.state.busy) { this.fail('Inspect changes or run a review before saving a report.'); return; }
    if (!path.toLowerCase().endsWith('.json')) { this.fail('Choose a .json filename for the report. Task files are not written by this interface.'); return; }
    const operation = ++this.operation;
    this.state.busy = 'Saving report'; this.state.error = null; this.state.savedPath = null;
    this.state.tab = 'Overview'; this.state.scroll = 0; this.refresh();
    try {
      const destination = resolve(this.services.cwd, path);
      await this.services.save(destination, this.state.report);
      if (this.operation === operation && !this.closed) {
        this.state.savedPath = destination; this.state.tab = 'Overview'; this.state.scroll = 0;
        this.state.notice = `Record saved successfully: ${destination}`;
      }
    } catch (error) {
      if (this.operation === operation && !this.closed) {
        this.state.error = friendlyError(error); this.state.notice = 'Record was not saved. See the error for the next step.';
      }
    } finally {
      if (this.operation === operation) {
        this.state.busy = null; this.refresh();
        if (this.closeRequested) this.close();
      }
    }
  }

  cancel(): void {
    // File writes cannot be cancelled safely once started. Wait for the exclusive write.
    if (this.state.busy === 'Saving report' || this.state.busy === 'Database request') return;
    this.operation++; this.abort?.abort(); this.abort = null; this.state.busy = null;
    this.state.notice = 'Operation cancelled. A submitted AI request may still be billed by the provider.';
    this.refresh();
  }
  close(): void {
    if (this.state.busy === 'Saving report' || this.state.busy === 'Database request') {
      this.closeRequested = true; this.state.notice = 'Finishing the current storage request before exiting.'; this.refresh(); return;
    }
    this.#sessionKeys = {}; this.state.editor = null;
    this.services.database?.signOut();
    this.closed = true; this.operation++; this.abort?.abort(); this.exit();
  }

  async handle(text: string | undefined, key: Key = {}): Promise<void> {
    if (this.closed) return;
    if (key.ctrl && key.name === 'c') { this.close(); return; }
    const state = this.state;
    if (state.editor) {
      const e = state.editor;
      if (key.name === 'escape') { state.editor = null; this.refresh(); return; }
      if (key.name === 'return') { await this.finishEdit(); return; }
      if (key.ctrl && key.name === 'u') { e.value = ''; e.cursor = 0; e.replace = false; }
      else if (key.name === 'left' || key.name === 'right' || key.name === 'home' || key.name === 'end') {
        e.replace = false;
        e.cursor = key.name === 'home' ? 0 : key.name === 'end' ? e.value.length : Math.max(0, Math.min(e.value.length, e.cursor + (key.name === 'left' ? -1 : 1)));
      } else if (key.name === 'backspace') {
        if (e.replace) { e.value = ''; e.cursor = 0; }
        else if (e.cursor > 0) { e.value = e.value.slice(0, e.cursor - 1) + e.value.slice(e.cursor); e.cursor--; }
        e.replace = false;
      } else if (key.name === 'delete') { e.value = e.value.slice(0, e.cursor) + e.value.slice(e.cursor + 1); e.replace = false; }
      else if (text && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f-\x9f]/.test(text)) {
        if (e.replace) { e.value = ''; e.cursor = 0; e.replace = false; }
        if (e.value.length + text.length <= 4096) { e.value = e.value.slice(0, e.cursor) + text + e.value.slice(e.cursor); e.cursor += text.length; }
      }
      this.refresh(); return;
    }
    if (state.confirmReview) {
      state.confirmReview = false;
      if (key.name === 'return' || text === 'y') await this.review();
      else this.refresh();
      return;
    }
    if (text === 'q') { this.close(); return; }
    if (state.busy) { if (key.name === 'escape') this.cancel(); return; }
    if (text === '?' || key.name === 'f1') { state.help = !state.help; state.scroll = 0; this.refresh(); return; }
    if (state.help) { if (key.name === 'escape') state.help = false; else if (key.name === 'pagedown') state.scroll += 8; else if (key.name === 'pageup') state.scroll = Math.max(0, state.scroll - 8); this.refresh(); return; }
    if (key.name === 'up') state.selected = (state.selected + menu.length - 1) % menu.length;
    else if (key.name === 'down') state.selected = (state.selected + 1) % menu.length;
    else if (key.name === 'tab' || key.name === 'right' || key.name === 'left') {
      const direction = key.name === 'left' || key.shift ? -1 : 1;
      state.tab = tabs[(tabs.indexOf(state.tab) + direction + tabs.length) % tabs.length]!; state.scroll = 0;
    } else if (key.name === 'pagedown' || text === 'j') state.scroll += key.name === 'pagedown' ? 8 : 1;
    else if (key.name === 'pageup' || text === 'k') state.scroll = Math.max(0, state.scroll - (key.name === 'pageup' ? 8 : 1));
    else if (text === 'i') { await this.inspect(); return; }
    else if (text === 'r') { this.requestReview(); return; }
    else if (text === 's') { if (state.report) this.edit('save'); else this.fail('Inspect changes before saving a report.'); return; }
    else if (key.name === 'return') {
      switch (menu[state.selected]) {
        case 'Repository': this.edit('repo'); return;
        case 'Comparison':
          if (state.comparison === 'Latest commit') { state.comparison = 'Branch changes'; state.base = 'origin/main'; state.head = 'HEAD'; }
          else if (state.comparison === 'Branch changes') { state.comparison = 'Custom range'; this.edit('base'); }
          else { state.comparison = 'Latest commit'; state.base = 'HEAD~1'; state.head = 'HEAD'; }
          this.invalidate(); break;
        case 'Base revision': this.edit('base'); return;
        case 'Head revision': this.edit('head'); return;
        case 'AI provider': state.provider = state.provider === 'anthropic' ? 'openai' : 'anthropic'; this.refreshCredential(); break;
        case 'AI API key': this.edit('apiKey'); return;
        case 'Model': this.edit('model'); return;
        case 'Inspect changes': await this.inspect(); return;
        case 'Run AI review': this.requestReview(); return;
        case 'Database URL': this.edit('databaseUrl'); return;
        case 'Database key': this.edit('databaseKey'); return;
        case 'Email sign-in': this.edit('email'); return;
        case 'Enter sign-in code': this.edit('code'); return;
        case 'Repository label': this.edit('repositoryLabel'); return;
        case 'Save to database': await this.saveDatabase(); return;
        case 'Load history': await this.loadHistory(); return;
        case 'Sign out': this.services.database?.signOut(); state.databaseStatus = 'Signed out'; state.history = []; state.notice = 'Signed out locally. No session tokens are saved on disk.'; break;
        case 'Password sign-in': this.edit('passwordEmail'); return;
        case 'Save report': if (state.report) this.edit('save'); else this.fail('Inspect changes before saving a report.'); return;
      }
    }
    this.refresh();
  }
}
