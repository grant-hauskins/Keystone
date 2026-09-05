import { appendFile } from 'node:fs/promises';
import { runKeystone } from './pipeline.js';

// Phase 1 adapter only. Event resolution, comments, and context commits are Phase 2.
async function main(): Promise<void> {
  const provider = process.env.INPUT_PROVIDER || 'anthropic';
  if (provider !== 'anthropic' && provider !== 'openai') throw new Error('Provider must be anthropic or openai.');
  const dryRun = process.env['INPUT_DRY-RUN'] || 'true';
  if (dryRun !== 'true' && dryRun !== 'false') throw new Error('dry-run must be true or false.');
  if (!process.env.GITHUB_OUTPUT) throw new Error('GitHub output file is unavailable; use the CLI locally.');
  const report = await runKeystone({
    repo: process.env.GITHUB_WORKSPACE || process.cwd(),
    base: process.env.INPUT_BASE || 'origin/main', head: process.env.INPUT_HEAD || 'HEAD',
    provider, model: process.env.INPUT_MODEL, dryRun: dryRun === 'true',
    apiKey: process.env[provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'],
  });
  // JSON encodes embedded newlines, so model content cannot inject output commands.
  const status = report.evaluation?.audit.status ?? 'not-evaluated';
  await appendFile(process.env.GITHUB_OUTPUT, `report=${JSON.stringify(report)}\naudit-status=${status}\n`);
  console.log(`Keystone: Record saved to this step's report output. ${report.status}; ${report.files.length} changed files; audit ${status}.`);
  if (status === 'fail') process.exitCode = 2;
}

main().catch(() => {
  // No raw model text or exception details enter the workflow command channel.
  console.error('Keystone failed. Check fetched refs, committed context, provider settings, and credentials.');
  process.exitCode = 1;
});
