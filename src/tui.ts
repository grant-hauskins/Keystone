import { emitKeypressEvents, type Key } from 'node:readline';
import { parseArgs } from 'node:util';
import { TuiModel } from './tui/model.js';
import { renderFrame, safeText } from './tui/render.js';

function main(): void {
  const { values } = parseArgs({ options: {
    repo: { type: 'string' }, base: { type: 'string' }, head: { type: 'string' },
    provider: { type: 'string' }, model: { type: 'string' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log(`Keystone interactive terminal
Usage: npm start -- [--repo PATH] [--base REF] [--head REF] [--provider NAME] [--model ID]
All settings can also be changed inside the interface.
Requires an interactive terminal at least 76 columns by 22 rows.
Use npm run keystone -- --help for the scriptable CLI.`);
    return;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Open Keystone in an interactive terminal with npm start. For redirected output, use npm run keystone -- --help.');
  }
  const provider = values.provider ?? process.env.KEYSTONE_PROVIDER ?? 'anthropic';
  if (provider !== 'anthropic' && provider !== 'openai') throw new Error('Provider must be anthropic or openai.');
  let tick = 0; let closed = false;
  const previousRaw = process.stdin.isRaw;
  let timer: NodeJS.Timeout;
  const draw = () => {
    if (closed) return;
    const frame = renderFrame(model.state, process.stdout.columns, process.stdout.rows, !('NO_COLOR' in process.env), tick);
    model.state.scroll = frame.scroll;
    process.stdout.write('\x1b[H' + frame.output + '\x1b[J');
  };
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    process.stdin.off('keypress', onKey);
    process.stdout.off('resize', draw);
    process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal);
    process.off('exit', cleanup);
    if (process.stdin.isTTY) process.stdin.setRawMode(Boolean(previousRaw));
    process.stdin.pause();
    process.stdout.write('\x1b[?25h\x1b[?1049l');
    if (model.state.savedPath) console.log(`Keystone: Record saved successfully to ${safeText(model.state.savedPath)}`);
    else if (model.state.notice.startsWith('Record was not saved')) console.error(`Keystone: Record was not saved. ${safeText(model.state.error ?? '')}`);
  };
  const model = new TuiModel({ ...values, provider, model: values.model ?? process.env.KEYSTONE_MODEL }, undefined, draw, cleanup);
  const onKey = (text: string | undefined, key: Key) => {
    void model.handle(text, key).catch(() => {
      cleanup(); console.error('Keystone could not continue the terminal session. Your repository was not edited.'); process.exitCode = 1;
    });
  };
  const onSignal = () => { model.close(); };
  process.on('exit', cleanup);
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
  process.stdout.on('resize', draw);
  emitKeypressEvents(process.stdin);
  process.stdin.on('keypress', onKey);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write('\x1b[?1049h\x1b[?25l\x1b[2J');
  timer = setInterval(() => { if (model.state.busy) { tick++; draw(); } }, 150);
  draw();
}

try { main(); } catch (error) {
  console.error(error instanceof Error ? error.message : 'Could not open Keystone.');
  process.exitCode = 1;
}
