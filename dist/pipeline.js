import { collectSnapshot } from './git.js';
import { evaluate } from './llm.js';
export async function runKeystone(options) {
    const snapshot = await collectSnapshot(options.repo, options.base, options.head);
    const report = {
        version: 1, status: snapshot.diff ? 'dry-run' : 'no-changes',
        base: snapshot.base, head: snapshot.head, mergeBase: snapshot.mergeBase,
        rulesSource: snapshot.rulesSource, files: snapshot.files,
        contextFiles: Object.keys(snapshot.context), diffBytes: Buffer.byteLength(snapshot.diff),
        warnings: snapshot.warnings, provider: null, model: null, evaluation: null,
    };
    if (!snapshot.diff || options.dryRun)
        return report;
    const provider = options.provider ?? 'anthropic';
    if (provider !== 'anthropic' && provider !== 'openai')
        throw new Error('Provider must be anthropic or openai.');
    const model = options.model ?? '';
    const evaluation = await evaluate(snapshot, { provider, model, apiKey: options.apiKey ?? '', fetcher: options.fetcher });
    return { ...report, status: 'evaluated', provider, model, evaluation };
}
