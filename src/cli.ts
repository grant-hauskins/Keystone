import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs, stripVTControlCharacters } from 'node:util';
import { collectSnapshot } from './git.js';
import { runSnapshot } from './pipeline.js';
import { SupabaseStore, loadConnection, unattendedDatabase, validateReport } from './storage/supabase.js';
import type { Provider, Report } from './types.js';

const HELP = `Keystone: audit committed code changes in plain English.
Usage: npm run keystone -- [options]        (after building: node build/cli.js [options])

Inspect or review a repository (default mode):
  --repo PATH          Repository directory (default: current directory)
  --base REF           Comparison base (default: origin/main)
  --head REF           Comparison head (default: HEAD)
  --provider NAME      anthropic (default) or openai; also KEYSTONE_PROVIDER
  --model ID           Provider model ID; also KEYSTONE_MODEL (required for live calls)
  --dry-run            Inspect the range without calling a provider
  --include-snapshot   Add the committed diff, rules, and context to the JSON output
  --output PATH        Save JSON to a new file; existing files are never overwritten

Save an existing report to Supabase:
  --save-db --input REPORT.json --label owner/repository [--record-id UUID]

Read the latest 20 saved records for a label:
  --history --label owner/repository

Database modes read KEYSTONE_DB_URL and KEYSTONE_DB_KEY (or .keystone-supabase.json in
--config-dir) plus KEYSTONE_DB_EMAIL and KEYSTONE_DB_PASSWORD from the environment.
Set ANTHROPIC_API_KEY or OPENAI_API_KEY in your environment for live reviews.
Only committed files are read. No files are synchronized or committed.
Exit: 0 success/dry-run/no changes, 1 operational error, 2 audit failure.`;

// Paths and IDs are echoed to the terminal; strip anything that could drive it.
function plain(text: string): string {
  return stripVTControlCharacters(text).replace(/[\x00-\x1f\x7f-\x9f]/g, '');
}

function label(value: string | undefined): string {
  if (!value?.trim() || value.length > 300) throw new Error('Set --label owner/repository (1-300 characters) for database operations.');
  return value.trim();
}

async function database(configDir: string) {
  const connection = await loadConnection(configDir);
  const store = new SupabaseStore(configDir);
  if (connection) store.useConnection(connection);
  const db = unattendedDatabase(store, connection);
  if (!db) {
    throw new Error('Database is not configured. Set KEYSTONE_DB_URL and KEYSTONE_DB_KEY (or .keystone-supabase.json in --config-dir) plus KEYSTONE_DB_EMAIL and KEYSTONE_DB_PASSWORD in the environment.');
  }
  return db;
}

async function readReport(path: string): Promise<Report> {
  let parsed: unknown;
  try { parsed = JSON.parse(await readFile(path, 'utf8')); }
  catch { throw new Error('Cannot read the report file. Pass --input with a JSON report written by Keystone.'); }
  return validateReport(parsed);
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: {
    repo: { type: 'string' }, base: { type: 'string' }, head: { type: 'string' },
    provider: { type: 'string' }, model: { type: 'string' }, output: { type: 'string' },
    'dry-run': { type: 'boolean', default: false }, 'include-snapshot': { type: 'boolean', default: false },
    'save-db': { type: 'boolean', default: false }, input: { type: 'string' }, label: { type: 'string' },
    'record-id': { type: 'string' }, history: { type: 'boolean', default: false }, 'config-dir': { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) { console.log(HELP); return; }
  const configDir = values['config-dir'] ?? process.cwd();

  if (values.history) {
    const repository = label(values.label);
    const records = await (await database(configDir)).history(repository);
    console.log(`${JSON.stringify(records, null, 2)}\n`);
    return;
  }
  if (values['save-db']) {
    if (!values.input) throw new Error('--save-db saves an existing report: pass --input REPORT.json (write one first with --output).');
    const repository = label(values.label);
    const report = await readReport(values.input);
    const id = values['record-id'] ?? randomUUID();
    const saved = await (await database(configDir)).save(id, repository, report);
    console.error(`Keystone: Record saved successfully to Supabase: ${plain(saved)}`);
    console.log(JSON.stringify({ saved: true, recordId: saved, repository }));
    return;
  }

  const provider: string = values.provider ?? process.env.KEYSTONE_PROVIDER ?? 'anthropic';
  if (provider !== 'anthropic' && provider !== 'openai') throw new Error('Provider must be anthropic or openai.');
  const snapshot = await collectSnapshot(values.repo ?? process.cwd(), values.base, values.head);
  const report = await runSnapshot(snapshot, {
    dryRun: values['dry-run'], provider: provider as Provider, model: values.model ?? process.env.KEYSTONE_MODEL,
    apiKey: process.env[provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'],
  });
  // The snapshot is optional extra data for hosts that render the diff themselves (Conductor).
  // A report file that carries it is still accepted by --save-db: validation drops unknown fields.
  const output = values['include-snapshot']
    ? { ...report, snapshot: { diff: snapshot.diff, rules: snapshot.rules, context: snapshot.context } }
    : report;
  const json = `${JSON.stringify(output, null, 2)}\n`;
  if (values.output) {
    await writeFile(values.output, json, { flag: 'wx', mode: 0o600 });
    console.error(`Keystone: Record saved successfully to ${plain(resolve(values.output))}`);
  }
  console.log(json);
  if (report.evaluation?.audit.status === 'fail') process.exitCode = 2;
}

main().catch(error => {
  const message = error instanceof Error ? error.message : 'Unexpected failure.';
  console.error(`Keystone: ${message}`);
  process.exitCode = 1;
});
