import { realpath } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { collectSnapshot } from './git.js';
import { runSnapshot } from './pipeline.js';
import { SupabaseStore, loadConnection } from './storage/supabase.js';
import { AgentSession, type AgentServices } from './mcp/service.js';
import { createAgentServer } from './mcp/server.js';

async function main(): Promise<void> {
  const { values } = parseArgs({ options: {
    repo: { type: 'string' }, label: { type: 'string' }, 'config-dir': { type: 'string' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.error('Keystone MCP: node build/mcp.js --repo ABSOLUTE_REPOSITORY_PATH --label owner/repository [--config-dir KEYSTONE_FOLDER]\nLocal stdio server; configure this command in your MCP host, not npm start. Credentials come from the server environment.'); return;
  }
  if (!values.repo || !values.label?.trim() || values.label.length > 300) throw new Error('Set --repo and --label owner/repository for this MCP connection.');
  const repository = await realpath(values.repo);
  const secrets = [process.env.ANTHROPIC_API_KEY, process.env.OPENAI_API_KEY, process.env.KEYSTONE_DB_PASSWORD].filter((value): value is string => Boolean(value));
  const connection = await loadConnection(values['config-dir'] ?? process.cwd());
  const store = new SupabaseStore(values['config-dir'] ?? process.cwd());
  if (connection) store.useConnection(connection);
  const database = connection && process.env.KEYSTONE_DB_EMAIL && process.env.KEYSTONE_DB_PASSWORD ? {
    save: async (...args: Parameters<SupabaseStore['save']>) => {
      await store.signInPassword(process.env.KEYSTONE_DB_EMAIL!, process.env.KEYSTONE_DB_PASSWORD!);
      return store.save(...args);
    },
    history: async (label: string) => {
      await store.signInPassword(process.env.KEYSTONE_DB_EMAIL!, process.env.KEYSTONE_DB_PASSWORD!);
      return store.history(label);
    },
  } : undefined;
  const services: AgentServices = { inspect: collectSnapshot, run: runSnapshot,
    key: provider => process.env[provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'] ?? '', database };
  const handle = serveStdio(() => createAgentServer(new AgentSession(repository, values.label!, services), secrets), {
    onerror: () => console.error('Keystone MCP transport error.'),
  });
  const close = () => { store.signOut(); void handle.close(); };
  process.once('SIGINT', close); process.once('SIGTERM', close);
}

main().catch(() => { console.error('Keystone MCP could not start. Check --repo, --label, and the public connection configuration.'); process.exitCode = 1; });
