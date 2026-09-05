import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Snapshot } from './types.js';

const execute = promisify(execFile);
const MAX_BYTES = 250_000;

async function git(repo: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execute('git', args, {
      cwd: repo, encoding: 'utf8', maxBuffer: 2_000_000,
      timeout: 30_000, windowsHide: true,
    });
    return stdout;
  } catch {
    // Git stderr can contain repository data; do not put it in logs.
    throw new Error('Git operation failed. Check the repository, available refs, full history, and input size.');
  }
}

async function resolveCommit(repo: string, ref: string): Promise<string> {
  if (!ref.trim() || ref.startsWith('-')) throw new Error('Invalid Git reference.');
  try {
    return (await git(repo, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`])).trim();
  } catch {
    throw new Error('Cannot resolve a commit. Fetch the base branch or pass --base and --head explicitly.');
  }
}

export function enforceSize(text: string, label: string): void {
  if (Buffer.byteLength(text) > MAX_BYTES) {
    throw new Error(`${label} exceeds ${MAX_BYTES} bytes. Use a smaller commit range; nothing was sent.`);
  }
}

function sensitivePath(path: string): boolean {
  return /(^|\/)(\.env(?:\..*)?|id_rsa|id_ed25519|credentials(?:\..*)?)$|\.(pem|p12|pfx|key)$/i.test(path);
}

export async function collectSnapshot(repo: string, baseRef = 'origin/main', headRef = 'HEAD'): Promise<Snapshot> {
  const base = await resolveCommit(repo, baseRef);
  const head = await resolveCommit(repo, headRef);
  const mergeBase = (await git(repo, ['merge-base', base, head])).trim();
  const files = (await git(repo, ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', '-z', `${base}...${head}`, '--']))
    .split('\0').filter(Boolean);
  if (files.some(sensitivePath)) throw new Error('The diff touches a likely credential file. Remove secrets from the comparison before evaluating.');
  const diff = await git(repo, ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--unified=3', `${base}...${head}`, '--']);
  enforceSize(diff, 'Diff');

  // Read Git blobs rather than working-tree files: context matches the evaluated head,
  // and symlinks cannot escape the repository. Use base rules so a change cannot
  // quietly relax its own audit criteria.
  const headPaths = (await git(repo, ['ls-tree', '-r', '--name-only', '-z', head, '--'])).split('\0').filter(Boolean);
  const baseRules = (await git(repo, ['ls-tree', '--name-only', base, '--', 'CLAUDE.md'])).trim();
  const rulesSource = baseRules ? base : head;
  if (!headPaths.includes('CLAUDE.md') && !baseRules) throw new Error('Missing committed CLAUDE.md project rules.');
  if (!headPaths.includes('.context/active-task.md')) throw new Error('Missing committed .context/active-task.md.');
  const readBlob = async (commit: string, path: string): Promise<string> => {
    const entry = await git(repo, ['ls-tree', commit, '--', path]);
    if (!/^100(644|755) blob /.test(entry)) throw new Error('Context must contain regular Markdown files, not links or submodules.');
    const content = await git(repo, ['show', `${commit}:${path}`]);
    enforceSize(content, 'Context file');
    return content;
  };
  const rules = await readBlob(rulesSource, 'CLAUDE.md');
  if (!rules.trim()) throw new Error('CLAUDE.md must contain project rules.');
  const context: Record<string, string> = {};
  for (const path of headPaths.filter(path => path.startsWith('.context/') && path.endsWith('.md')).sort()) {
    context[path] = await readBlob(head, path);
    enforceSize(JSON.stringify(context), 'Combined context');
  }
  if (!context['.context/active-task.md']?.trim()) throw new Error('The canonical active task must not be empty.');
  const warnings: string[] = [];
  if (!baseRules) warnings.push('Bootstrap audit: base has no CLAUDE.md; rules come from the evaluated head and are not independently trusted.');
  if ((await git(repo, ['status', '--porcelain'])).trim()) warnings.push('Working-tree changes are excluded; only committed changes and context are evaluated.');
  if (/^Binary files .* differ$/m.test(diff)) warnings.push('Binary changes are listed, but their contents are not evaluated.');
  return { base, head, mergeBase, rulesSource, rules, context, files, diff, warnings };
}
