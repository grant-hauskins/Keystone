# Keystone

Keystone helps people understand what their coding agents changed. It compares
committed code with project rules, explains the changes in plain English, and
proposes an updated task record.

**Phase 1:** a working local evaluation pipeline and a small GitHub Action adapter.
Automatic context writes, commits, and PR comments are planned for Phase 2.

## Run locally

Requires Node.js 24+, npm, Git, and a repository with committed `CLAUDE.md` and
`.context/active-task.md` files. The latter is the canonical task record.

```sh
npm ci
npm run build
npm test
npm run keystone -- --dry-run
```

The default comparison is `git diff origin/main...HEAD`. Commit your work to a
feature branch first. Uncommitted changes, including edits to context, are excluded
and reported as a warning. A fresh clone with no branch changes returns `no-changes`.
Keystone does not fetch for you: run `git fetch origin main` when needed.

For a different comparison:

```sh
npm run keystone -- --base main --head feature/my-change --dry-run
```

### Ask a model to evaluate

Set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` in your environment using your secret
manager. Do not put the value in code or command-line arguments. `.env` files are
ignored by Git and are **not** automatically loaded.

```sh
npm run keystone -- --provider anthropic --model claude-haiku-4-5-20251001
npm run keystone -- --provider openai --model YOUR_OPENAI_MODEL_ID
```

The model must support the provider's structured response mechanism. Model access
depends on your API account. `KEYSTONE_PROVIDER` and `KEYSTONE_MODEL` can supply
defaults. No model is silently selected for live calls.

The evaluated diff, base rules, and committed `.context/**/*.md` files are sent to
the selected provider. The request has a 60-second timeout and a 4,096-token output
budget. Failed requests are not automatically retried, so retries remain under
your control. Local dry runs make no API calls.

Save the result to a new JSON file:

```sh
npm run keystone -- --provider anthropic --model claude-haiku-4-5-20251001 --output keystone-report.json
```

After building, `node build/cli.js` accepts the same arguments and writes clean JSON
to standard output, without npm's banner. `--output` never overwrites an existing
file. Source files and the canonical task record are never modified by Phase 1.

## Understanding the result

Reports include the resolved base, head, merge base, rules source, changed files,
context filenames, input warnings, and an evaluation when an API call succeeds.

- `summary` and `changes`: an explanation for someone who does not write code.
- `audit`: `pass`, `warn`, or `fail`, with a rule, explanation, and evidence for
  each finding. A pass is an advisory model opinion, not proof of correctness.
- `proposedActiveTask`: a suggested complete Markdown update for
  `.context/active-task.md`. Review it before applying it.

`dry-run` and `no-changes` reports have no evaluation; they never claim an audit
passed. Exit codes are 0 for success (including warnings), dry runs, or no changes;
1 for operational errors; and 2 for an evaluated audit failure.

Keystone reads rules from the comparison base and context from the evaluated head.
When bootstrapping a repository without base rules, it uses head rules and flags
that they are not independently trusted. Rules are never rewritten by a model.

## GitHub Action starter

`action.yml` calls the same core pipeline using checked-in Node.js 24 modules.
Its default is a dry run. The calling workflow is responsible for checkout, full
history, selecting base/head, and passing an API credential for a live evaluation.
This adapter emits `report` and `audit-status` outputs; it does not post comments
or push commits.

Example step after checking out a feature branch with full history:

```yaml
- uses: grant-hauskins/Keystone@YOUR_REVIEWED_COMMIT_SHA
  id: keystone
  with:
    base: origin/main
    head: HEAD
    dry-run: 'true'
```

For live evaluation, set `dry-run: 'false'`, `provider`, and `model`, and provide
`ANTHROPIC_API_KEY` or `OPENAI_API_KEY` through the step's `env` from Actions secrets.
Use a reviewed pinned action commit and run only on trusted code when secrets are
available. Do not expose secrets to untrusted pull-request code. Phase 1 requires
only read access to repository contents and installs no automatic workflow.

**Event semantics:** PR workflows should compare the PR base SHA with its head SHA.
For pushes to the default branch, compare the push's `before` SHA with its `after`
SHA; comparing `origin/main...HEAD` after checkout of main would usually be empty.
Deleted branches, initial pushes with a zero `before` SHA, and unrelated histories
need caller handling until the Phase 2 event adapter is implemented.

## Development

- `src/git.ts`: bounded Git diff extraction and committed context loading.
- `src/llm.ts`: native HTTP adapters for Anthropic Messages and OpenAI Responses.
- `src/evaluation.ts`: shared output schema and runtime validation.
- `src/pipeline.ts`: provider-independent orchestration.
- `src/cli.ts`: standalone local entry point.
- `src/keystoneAction.ts`: thin Action adapter.

Run `npm run check`, `npm test`, and `npm run build` before committing. Commit the
regenerated `dist/` modules with source changes so Actions can run without
installing dependencies. Tests use temporary Git repositories and mock provider
responses; they require no credentials and incur no API cost.

Read `CLAUDE.md` and `.context/active-task.md` before starting work, and update the
task record after every completed feature.

## Current limits

- Diffs, combined context, and combined request input have 250,000-byte limits;
  larger input fails rather than being silently truncated. Git output has a
  separate 2 MB hard buffer limit. Split large changes into smaller comparisons.
- Binary file changes are identified but their contents are not reviewed.
- Likely credential file paths and accidental inclusion of the active API key are
  rejected. This is not a comprehensive secret scanner; only send reviewed code
  and context suitable for your provider.
- Prompt separation and schema validation reduce risk but cannot guarantee model
  accuracy or eliminate prompt injection. No tools or commands from the model run.
- Context sync, auto-commits, PR comments, retry policy, and event-aware triggers
  remain future work.

## API references

Adapters follow [Anthropic Messages](https://platform.claude.com/docs/en/api/http/messages/create)
and [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
The wrapper uses [GitHub's JavaScript action metadata](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax).
