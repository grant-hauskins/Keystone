export type Provider = 'anthropic' | 'openai';

export interface Snapshot {
  base: string;
  head: string;
  mergeBase: string;
  rulesSource: string;
  rules: string;
  context: Record<string, string>;
  files: string[];
  diff: string;
  warnings: string[];
}

export interface Evaluation {
  summary: string;
  changes: string[];
  audit: {
    status: 'pass' | 'warn' | 'fail';
    findings: Array<{
      rule: string;
      severity: 'warning' | 'error';
      explanation: string;
      evidence: string;
    }>;
  };
  proposedActiveTask: string;
}

export interface Report {
  version: 1;
  status: 'evaluated' | 'dry-run' | 'no-changes';
  base: string;
  head: string;
  mergeBase: string;
  rulesSource: string;
  files: string[];
  contextFiles: string[];
  diffBytes: number;
  warnings: string[];
  provider: Provider | null;
  model: string | null;
  evaluation: Evaluation | null;
}
