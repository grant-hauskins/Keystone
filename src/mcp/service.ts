import { randomUUID } from 'node:crypto';
import { collectSnapshot } from '../git.js';
import { runSnapshot } from '../pipeline.js';
import type { Provider, Report, Snapshot } from '../types.js';
import type { ReviewStore } from '../storage/supabase.js';

export interface AgentServices {
  inspect: typeof collectSnapshot;
  run: typeof runSnapshot;
  key: (provider: Provider) => string;
  database?: Pick<ReviewStore, 'save' | 'history'>;
}
interface Entry { snapshot: Snapshot; report: Report; recordId: string }

// Every connection is bound by its launcher to one repository, never by tool input.
export class AgentSession {
  private entries = new Map<string, Entry>();
  constructor(readonly repository: string, readonly label: string,
    private services: AgentServices = {
      inspect: collectSnapshot, run: runSnapshot,
      key: provider => process.env[provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'] ?? '',
    }) {}

  private add(entry: Entry): string {
    if (this.entries.size >= 16) this.entries.delete(this.entries.keys().next().value!);
    const id = randomUUID(); this.entries.set(id, entry); return id;
  }
  private entry(id: string): Entry {
    const entry = this.entries.get(id);
    if (!entry) throw new Error('Unknown or expired result ID. Inspect again; only the latest 16 results are retained per connection.');
    return entry;
  }
  async inspect(base = 'HEAD~1', head = 'HEAD') {
    const snapshot = await this.services.inspect(this.repository, base, head);
    const report = await this.services.run(snapshot, { dryRun: true });
    const resultId = this.add({ snapshot, report, recordId: randomUUID() });
    return { resultId, repository: this.label, report, rules: snapshot.rules, context: snapshot.context, diff: snapshot.diff };
  }
  async review(resultId: string, provider: Provider, model: string) {
    const entry = this.entry(resultId);
    const report = await this.services.run(entry.snapshot, { provider, model, apiKey: this.services.key(provider) });
    const reviewedId = this.add({ snapshot: entry.snapshot, report, recordId: randomUUID() });
    return { resultId: reviewedId, repository: this.label, report };
  }
  async save(resultId: string) {
    const entry = this.entry(resultId);
    if (!this.services.database) throw new Error('Supabase is not configured for this MCP process. Local inspection and AI review still work.');
    const id = await this.services.database.save(entry.recordId, this.label, entry.report);
    if (id !== entry.recordId) throw new Error('Database did not acknowledge the expected record.');
    return { saved: true, recordId: id, repository: this.label, message: `Record saved successfully to Supabase: ${id}` };
  }
  async history() {
    if (!this.services.database) throw new Error('Supabase is not configured for this MCP process.');
    return { repository: this.label, records: await this.services.database.history(this.label) };
  }
}
