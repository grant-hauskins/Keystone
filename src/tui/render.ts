import { stripVTControlCharacters } from 'node:util';
import { menu, tabs, type TuiState } from './model.js';

type Tone = 'normal' | 'title' | 'muted' | 'accent' | 'warning' | 'error' | 'selected';
interface Line { text: string; tone?: Tone }
const palette: Record<Tone, string> = {
  normal: '\x1b[38;5;252m', title: '\x1b[1;38;5;255m', muted: '\x1b[38;5;245m',
  accent: '\x1b[38;5;80m', warning: '\x1b[38;5;221m', error: '\x1b[38;5;210m',
  selected: '\x1b[48;5;24;38;5;255m',
};

// Repository paths, diffs, errors, and model output can all contain terminal escapes.
export function safeText(text: string): string {
  return stripVTControlCharacters(text).replace(/\r\n/g, '\n').replace(/\t/g, '  ')
    .replace(/[\x00-\x09\x0b-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, '');
}
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
function units(text: string): string[] { return Array.from(segmenter.segment(text), part => part.segment); }
function unitWidth(unit: string): number {
  const code = unit.codePointAt(0) ?? 0;
  if (/^\p{Mark}+$/u.test(unit)) return 0;
  return /\p{Extended_Pictographic}/u.test(unit) || (code >= 0x1100 && (
    code <= 0x115f || code === 0x2329 || code === 0x232a || (code >= 0x2e80 && code <= 0xa4cf)
    || (code >= 0xac00 && code <= 0xd7a3) || (code >= 0xf900 && code <= 0xfaff)
    || (code >= 0xfe10 && code <= 0xfe6f) || (code >= 0xff00 && code <= 0xff60)
    || (code >= 0xffe0 && code <= 0xffe6) || code >= 0x20000)) ? 2 : 1;
}
export function textWidth(text: string): number { return units(safeText(text)).reduce((sum, unit) => sum + unitWidth(unit), 0); }
function fit(text: string, width: number): string {
  let result = ''; let size = 0;
  for (const unit of units(safeText(text).replace(/\n/g, ' '))) {
    const next = unitWidth(unit);
    if (size + next > width) break;
    result += unit; size += next;
  }
  return result + ' '.repeat(Math.max(0, width - size));
}
export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of safeText(text).split('\n')) {
    let line = ''; let size = 0;
    for (const unit of units(paragraph)) {
      const next = unitWidth(unit);
      if (size + next > width && line) {
        const space = line.lastIndexOf(' ');
        if (space > 0 && line.trim()) {
          lines.push(line.slice(0, space)); line = line.slice(space + 1); size = textWidth(line);
        } else { lines.push(line); line = ''; size = 0; }
      }
      line += unit; size += next;
    }
    lines.push(line);
  }
  return lines;
}

function content(state: TuiState): Line[] {
  const result: Line[] = [];
  const add = (text: string, tone: Tone = 'normal') => result.push({ text, tone });
  if (state.help) {
    add('HOW TO USE KEYSTONE', 'accent'); add('');
    add('1. Choose a local Git repository. You can paste its folder path without command-line quotes.'); add('');
    add('2. Latest commit compares HEAD~1 to HEAD. Branch changes compares origin/main to HEAD. For a wider range, enter a custom base and head.'); add('');
    add('3. Inspect changes reads committed code, CLAUDE.md, and .context/active-task.md. It makes no AI call and ignores uncommitted changes.'); add('');
    add('4. Choose an AI provider and enter a model ID available in your account. Credentials come from ANTHROPIC_API_KEY or OPENAI_API_KEY in the environment.'); add('');
    add('5. Run AI review sends the inspected snapshot to the selected provider. You see what will be sent before confirming. API charges apply.'); add('');
    add('6. Browse the report with Tab or Left/Right. Scroll with PgUp/PgDn or j/k. Save creates a new JSON report at your chosen path, then confirms success and displays the saved location. It never applies the proposed task.'); add('');
    add('Missing context? Add project rules in CLAUDE.md and a short task description in .context/active-task.md, commit them in the selected repository, and inspect again.'); add('');
    add('Esc closes this help. q or Ctrl+C exits. Esc cancels an inspection or AI request; an already-submitted request may still incur charges.', 'muted');
    return result;
  }
  if (state.editor) {
    const labels = { repo: 'REPOSITORY FOLDER', base: 'BASE REVISION', head: 'HEAD REVISION', model: 'MODEL ID', save: 'SAVE REPORT' };
    add(labels[state.editor.field], 'accent'); add('');
    const descriptions = {
      repo: 'Paste a local repository folder. Spaces are supported; no shell command is needed.',
      base: 'Where the comparison starts. Examples: HEAD~1, origin/main, or an earlier commit ID.',
      head: 'Which commit to review. HEAD selects the latest commit on the checked-out branch.',
      model: 'Enter a provider model ID, not an API key. Use a model available in your account.',
      save: 'Choose a .json report path in an existing folder. An existing file is never overwritten.',
    };
    add(descriptions[state.editor.field]); add('');
    const e = state.editor;
    add(e.value.slice(0, e.cursor) + '|' + e.value.slice(e.cursor), 'title'); add('');
    add(e.replace ? 'Type to replace the current value; arrows keep it for editing.' : 'Editing the value.', 'muted');
    add('Enter accepts  /  Esc cancels  /  Ctrl+U clears', 'accent');
    return result;
  }
  if (state.confirmReview) {
    add('READY TO REVIEW', 'accent'); add('');
    add(`Provider: ${state.provider}`); add(`Model: ${state.models[state.provider]}`); add('');
    add(`${state.snapshot!.files.length} changed files plus committed project rules and task context will be sent to this provider.`); add('');
    add(`Commits: ${state.snapshot!.mergeBase.slice(0, 8)} -> ${state.snapshot!.head.slice(0, 8)}`, 'muted'); add('');
    add('This is an AI API request and may incur charges. Keystone will review the inspected snapshot, even if the branch moves afterward.'); add('');
    add('Enter / y: start review', 'accent'); add('Esc or any other key: go back', 'muted');
    return result;
  }
  const report = state.report;
  if (state.tab === 'Files') {
    add('CHANGED FILES', 'accent'); add('');
    if (!report) add('Inspect a repository to load its changed files.');
    else {
      add(`${report.files.length} files in this comparison`, 'muted'); add('');
      for (const file of report.files) add(`  ${file}`);
      add(''); add('CONTEXT INCLUDED', 'accent');
      add(`CLAUDE.md (rules at ${report.rulesSource.slice(0, 8)})`);
      for (const file of report.contextFiles) add(file);
    }
    return result;
  }
  if (state.tab === 'Diff') {
    add('COMMITTED CHANGES', 'accent'); add('');
    if (!state.snapshot) add('Inspect a repository to see its changes.');
    else if (!state.snapshot.diff) add('No changes in this comparison.');
    else for (const line of state.snapshot.diff.split('\n')) add(line, line.startsWith('+') ? 'accent' : line.startsWith('-') ? 'error' : line.startsWith('@@') ? 'warning' : 'normal');
    return result;
  }
  if (state.tab === 'Findings') {
    add('AUDIT FINDINGS', 'accent'); add('');
    if (!report?.evaluation) add('No AI review has run. Inspection alone does not check project rules.');
    else if (!report.evaluation.audit.findings.length) { add('The model reported no rule violations.'); add('This is an advisory result, not a guarantee.', 'muted'); }
    else report.evaluation.audit.findings.forEach((finding, i) => {
      add(`${i + 1}. ${finding.severity.toUpperCase()}`, finding.severity === 'error' ? 'error' : 'warning');
      add(finding.explanation); add(`Rule: ${finding.rule}`, 'muted'); add(`Evidence: ${finding.evidence}`, 'muted'); add('');
    });
    return result;
  }
  if (state.tab === 'Task') {
    add(report?.evaluation ? 'PROPOSED TASK UPDATE' : 'CURRENT COMMITTED TASK', 'accent');
    add(report?.evaluation ? 'Suggestion only. No repository files have been edited.' : 'Run an AI review to get a proposed update.', 'muted'); add('');
    add(report?.evaluation?.proposedActiveTask ?? state.snapshot?.context['.context/active-task.md'] ?? 'Inspect a repository to load its task context.');
    return result;
  }
  if (state.error) { add('ACTION NEEDED', 'error'); add(state.error); add(''); }
  if (state.savedPath) { add('RECORD SAVED SUCCESSFULLY', 'accent'); add(state.savedPath); add(''); }
  if (report?.evaluation) {
    const status = report.evaluation.audit.status;
    add(status === 'pass' ? 'REVIEW COMPLETE' : 'REVIEW NEEDS ATTENTION', status === 'pass' ? 'accent' : 'warning');
    add(`Advisory result: ${status.toUpperCase()}  |  ${report.provider} / ${report.model}`, 'muted'); add('');
    add(report.evaluation.summary, 'title'); add('');
    for (const change of report.evaluation.changes) { add(`- ${change}`); add(''); }
  } else {
    add(report ? report.status === 'no-changes' ? 'NO CHANGES FOUND' : 'INSPECTION READY' : 'START WITH A REPOSITORY', 'accent'); add('');
    add(report ? 'Your committed changes are loaded. No AI review has run.' : 'Select a local repository, choose what to compare, then inspect changes.'); add('');
  }
  add('REPOSITORY', 'muted'); add(state.repo); add('');
  add('COMPARISON', 'muted'); add(`${state.comparison}: ${state.base} ... ${state.head}`);
  if (report) {
    add(`Resolved base ${report.base.slice(0, 8)} / head ${report.head.slice(0, 8)}`, 'muted');
    add(`${report.files.length} changed files  /  ${(report.diffBytes / 1024).toFixed(1)} KB of changes`); add('');
    for (const warning of report.warnings) { add(warning, 'warning'); add(''); }
  }
  add('NEXT REVIEW', 'muted'); add(`${state.provider} / ${state.models[state.provider] || 'Select a model'}`);
  add(state.credentialReady ? 'API key is available in the environment.' : 'No API key found. You can still inspect changes.', state.credentialReady ? 'accent' : 'warning');
  return result;
}

export function renderFrame(state: TuiState, columns: number, rows: number, colors = true, tick = 0): { output: string; scroll: number } {
  const width = Math.max(20, Math.min(180, columns - 1));
  const height = Math.max(6, Math.min(80, rows - 1));
  const paint = (text: string, tone: Tone = 'normal') => colors ? palette[tone] + text + '\x1b[0m' : text;
  if (columns < 76 || rows < 22) {
    return { output: ['KEYSTONE', '', 'Enlarge this terminal to at least 76 columns and 22 rows.', 'q or Ctrl+C exits.'].flatMap(line => wrap(line, width)).slice(0, height).map(line => fit(line, width)).join('\r\n'), scroll: 0 };
  }
  const side = width >= 100 ? 28 : 23;
  const right = width - side - 5;
  const bodyHeight = height - 9;
  const document = content(state).flatMap(line => wrap(line.text, right).map(text => ({ text, tone: line.tone })));
  const scroll = state.editor || state.confirmReview ? 0 : Math.max(0, Math.min(state.scroll, document.length - bodyHeight));
  const lines: string[] = [];
  lines.push(paint(fit('  K E Y S T O N E', width - 15), 'title') + paint(fit('LOCAL REVIEW', 15), 'accent'));
  lines.push(paint(fit('  Understand what changed. Keep your context clear.', width), 'muted'));
  lines.push(paint('-'.repeat(width), 'muted'));
  const tabText = tabs.map(tab => tab === state.tab && !state.help ? `[${tab}]` : tab).join('  ');
  lines.push(paint(fit('  WORKSPACE', side + 3), 'muted') + paint(fit(state.help ? 'HELP' : tabText, right + 2), 'accent'));
  for (let i = 0; i < bodyHeight; i++) {
    let left = ''; let tone: Tone = 'muted';
    if (i < menu.length) { left = `${state.selected === i ? ' >' : '  '} ${menu[i]}`; tone = state.selected === i ? 'selected' : 'normal'; }
    else if (i === menu.length + 1) left = `  ${state.provider.toUpperCase()}`;
    else if (i === menu.length + 2) { left = state.credentialReady ? '  Key available' : '  Key not set'; tone = state.credentialReady ? 'accent' : 'warning'; }
    else if (i === menu.length + 4) left = state.busy ? `  ${['|', '/', '-', '\\'][tick % 4]} Working...` : '  Repository read-only';
    const line = document[scroll + i];
    lines.push(paint(fit(left, side), tone) + paint(' | ', 'muted') + paint(fit(line?.text ?? '', right + 2), line?.tone));
  }
  lines.push(paint('-'.repeat(width), 'muted'));
  const notice = state.busy ? `${state.busy}... ${state.busy === 'Saving report' ? '' : 'Esc cancels.'}` : state.notice;
  const noticeLines = wrap(notice, width - 4);
  lines.push(paint(fit('  ' + (noticeLines[0] ?? ''), width), state.busy ? 'accent' : 'muted'));
  lines.push(paint(fit('  ' + (noticeLines[1] ?? ''), width), 'muted'));
  const hint = state.editor ? '  Enter accept  Esc cancel  Ctrl+U clear  Arrows edit'
    : state.confirmReview ? '  Enter start AI review  Esc go back'
    : '  Up/Down select  Enter open  Tab views  PgUp/PgDn scroll';
  lines.push(paint(fit(hint, width), 'normal'));
  lines.push(paint(fit(`  i inspect  r review  s save  ? help  q quit${document.length > bodyHeight ? `   ${scroll + 1}-${Math.min(scroll + bodyHeight, document.length)}/${document.length}` : ''}`, width), 'accent'));
  return { output: lines.map(line => line + '\x1b[K').join('\r\n'), scroll };
}
