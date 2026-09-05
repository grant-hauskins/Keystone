import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { parseArgs } from 'node:util';
import { runKeystone } from './pipeline.js';

async function main(): Promise<void> {
  const { values } = parseArgs({ options: {
    repo: { type: 'string' }, base: { type: 'string' }, head: { type: 'string' },
    provider: { type: 'string' }, model: { type: 'string' }, output: { type: 'string' },
    'dry-run': { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log(`Keystone: audit committed code changes in plain English.
Usage: npm run keystone -- [options]
  --repo PATH        Repository directory (default: current directory)
  --base REF         Comparison base (default: origin/main)
  --head REF         Comparison head (default: HEAD)
  --provider NAME    anthropic (default) or openai; also KEYSTONE_PROVIDER
  --model ID         Provider model ID; also KEYSTONE_MODEL (required for live calls)
  --dry-run          Inspect the range without calling a provider
  --output PATH     Save JSON to a new file; existing files are never overwritten
Set ANTHROPIC_API_KEY or OPENAI_API_KEY in your environment.
Only committed files are read. No files are synchronized or committed.
Exit: 0 success/dry-run/no changes, 1 operational error, 2 audit failure.`);
    return;
  }
  const provider = values.provider ?? process.env.KEYSTONE_PROVIDER ?? 'anthropic';
  if (provider !== 'anthropic' && provider !== 'openai') throw new Error('Provider must be anthropic or openai.');
  const report = await runKeystone({
    repo: values.repo ?? process.cwd(), base: values.base, head: values.head,
    provider, model: values.model ?? process.env.KEYSTONE_MODEL, dryRun: values['dry-run'],
    apiKey: process.env[provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'],
  });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (values.output) {
    await writeFile(values.output, json, { flag: 'wx', mode: 0o600 });
    const destination = stripVTControlCharacters(resolve(values.output)).replace(/[\x00-\x1f\x7f-\x9f]/g, '');
    console.error(`Keystone: Record saved successfully to ${destination}`);
  }
  console.log(json);
  if (report.evaluation?.audit.status === 'fail') process.exitCode = 2;
}

main().catch(error => {
  const message = error instanceof Error ? error.message : 'Unexpected failure.';
  console.error(`Keystone: ${message}`);
  process.exitCode = 1;
});
