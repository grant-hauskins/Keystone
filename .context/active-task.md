# Active task

## Walkthrough materials update
Status: Complete; usage-only edition saved in the output kit and docs/walkthrough.
- Updated narration, source facts, producer prompt, and FAQ for the TUI AI-key field,
  Supabase saving/history, and use of an already-connected MCP agent.
- User reported setup complete and requested no PowerShell details. Removed command
  recipes and infrastructure setup from the kit; begin inside the configured app.
- Rebuilt combined NotebookLM source and ZIP; checked current menu/tool names and
  absence of old command recipes. No application code or test behavior changed.

## Current change: Add AI keys inside the TUI
Status: Complete locally; full suite passed 44 tests.
- Add a masked AI API key editor beside AI provider.
- Keep per-provider overrides only in memory and preserve environment fallback.
- Confirm setting the session key; never persist it in records or configuration.
- Verify replacement, provider switching, cancellation, and secret-free rendering.

## Current change: MCP agent connection
Status: Implemented locally; ready for an agent host to connect.
- Expose local stdio tools for inspection, pinned-snapshot AI review, Supabase save,
  and history using the same core pipeline as the TUI.
- Bind each server to one explicitly configured repository and stable label.
- Keep credentials in the launching process environment, out of tool arguments.
- Verify a real MCP client handshake and tool calls; document agent configuration.
- Full suite passed 47 tests, including real stdio discovery/inspection against a
  temporary Git repository and mocked review/save retry checks. No live LLM request
  or authenticated hosted database save was performed for this change.
- docs/mcp-setup.md documents tools, one-repository scope, credential forwarding,
  cache lifetime, after-save confirmation, and limits. Hosted HTTP MCP is not included.

## Current milestone: Supabase review storage
Status: Implemented locally; user reports setup complete; hosted save verification pending.

### Goal
Connect the TUI to Supabase with user sign-in, private saved review records,
and review history while preserving JSON export and canonical task files.

### Acceptance criteria
- [x] Add a versioned database migration with owner-only read/insert policies.
- [x] Configure public connection details, password sign-in, and optional email-code sign-in in the TUI.
- [x] Save reports with session retry-safe IDs and confirm only after database acknowledgement.
- [x] Browse saved records without changing the current inspected snapshot.
- [x] Test authentication failures, storage retries, and TUI behavior.
- [ ] Verify the hosted schema and a user-authorized save when setup is available.

### Decisions
- Keep sign-in tokens in memory only; never store provider keys in review records.
- Supabase stores history; .context/active-task.md remains canonical current task state.
- Public connection details supplied by the user are local configuration, not secrets.

### Verification and next step
- User reported the migration succeeded. Hosted Auth settings returned HTTP 200;
  anonymous review reads were denied with permission error 42501.
- npm test passed 42 tests. Windows PTY launch loaded the public configuration,
  the extended menu scrolled to database controls, and quit restored the terminal.
- docs/supabase-setup.md covers dashboard settings, sign-in, saving, history, and limits.
- Corrected the initial setup instructions: new Free projects cannot edit email
  templates without custom SMTP (June 3, 2026 restriction). Added password sign-in
  for a manually created, confirmed Supabase Auth user so testing needs no SMTP.
- Authenticated hosted save/read and live two-user isolation remain unverified.
- No review was uploaded during development. CLI/Action database storage, session
  refresh, pagination beyond 20 records, and shared team access are not implemented.

## Completed milestone: Interactive terminal interface
Status: Complete locally; ready for review.

### Goal
Let a person select a local repository, inspect committed changes, run an AI review,
and read or save its results without constructing CLI arguments.

### Acceptance criteria
- [x] Launch a keyboard-driven full-screen terminal interface with npm start.
- [x] Select a repository and comparison range; explain missing context and refs.
- [x] Inspect changes without an API call before explicitly starting a live review.
- [x] Select a provider/model and show credential availability without exposing keys.
- [x] Browse plain-English results, findings, changed files, and proposed task context.
- [x] Save a report to a new file without overwriting repository context.
- [x] Keep the CLI and Action behavior working; test the controller and terminal flow.
- [x] Verify the TUI against the local debate-engine repository and document usage.
- [x] Produce a reusable metaprompt for onboarding existing documentation and pseudocode.
- [x] Confirm successful record creation AFTER saving, as requested; no extra save-approval prompt.

### Scope
- Reuse the core pipeline. Feedback triage and automatic context writes remain future work.
- Never automatically create commits or edit a selected repository from the TUI.
- Terminal rendering must not execute control sequences from repository/model content.

### Verification and delivered records
- npm test built the source and Action modules and passed 32 tests with zero failures.
- Interactive Windows terminal checks covered startup, repository inspection, tabs,
  report export, success notification, and clean exit with restored terminal state.
- debate-engine comparison 99a5f1d...030b4c02 loaded three changed files and its committed
  canonical task. A dry-run report was saved outside that repository and confirmed
  to the user. No AI call or target-repository edit occurred in the TUI smoke test.
- Both provider contracts and pinned-snapshot review behavior were tested with mocks.
  No new live provider call or hosted Actions run was performed for the TUI changes.
- docs/keystone-adoption-metaprompt.md is the reusable onboarding guide. It distinguishes
  binding rules, current tasks, historical decisions, and unimplemented scaffolding,
  and includes conflict handling, commit checks, explicit comparisons, and after-save notices.
- The CLI confirms file saves on stderr, preserving JSON stdout. The Action confirms
  writing its report output. Failed writes never emit a success confirmation.
- Settings remain session-only; feedback triage and automatic context sync remain future work.
- Created a separate Keystone-Walkthrough-Kit deliverable with verified product facts,
  hidden-input key setup, narrated shot list, video-production prompt, and accuracy checklist.
  Confirmed that the TUI reads environment keys and has no key editor; no application
  behavior changed and no new live AI review was run for the walkthrough documentation.

## Completed milestone: Phase 1 standalone evaluation pipeline
Status: Complete locally; ready for review.

### Goal
Read committed changes and project context, check changes against CLAUDE.md,
and produce a plain-English report using Anthropic or OpenAI.

### Acceptance criteria
- [x] Reuse the existing grant-hauskins/Keystone repository.
- [x] Create project rules and canonical task context before writing code.
- [x] Extract a configurable three-dot Git diff (default origin/main...HEAD).
- [x] Load CLAUDE.md and Markdown files under .context/.
- [x] Evaluate with a configurable provider and model; validate structured output.
- [x] Support a local dry run without credentials.
- [x] Verify the pipeline with local Git repositories and mocked API responses.
- [x] Add action.yml and src/keystoneAction.ts as a starter wrapper.
- [x] Document local usage and the boundary between Phase 1 and future sync work.

### Decisions
- Phase 1 produces a report and proposed task update; automatic commits, PR comments,
  and automatic changes to project rules belong to subsequent milestones.
- API credentials come from environment variables and are never committed.
- The initial repository contains only a Java-oriented .gitignore; preserve it and
  add Node-specific exclusions.

### Verification and blockers
- Repository cloned successfully. Node.js 24 is available.
- GitHub CLI access repaired with a separate sandbox login; the original user login
  is unchanged. Credential storage remains outside the repository.
- Anthropic credential is present in the environment (value was not read or printed).
- TypeScript checks and 19 automated tests pass. Both provider contracts, local Git
  behavior, malformed responses, errors, and timeouts have been exercised.
- Context is read from committed blobs; base-branch rules prevent a proposed change
  from relaxing its own audit. Bootstrapping without base rules is explicitly flagged.
- The compiled CLI and shipped Action adapter both passed local smoke tests.
- Live Anthropic evaluation completed for 933c378...edacd5c with
  claude-haiku-4-5-20251001. Structured output and multiline Markdown validation passed.
- The advisory result was warn: bootstrap rules and verification evidence not visible
  to the model. Local execution separately confirmed 19 passing tests. The model's
  interpretation of mocked tests as pending live tests was not adopted as fact.
- OpenAI request/response behavior is covered by mock tests; a live OpenAI call has
  not been run because no OpenAI credential was available.
- Earlier live calls exposed malformed lists and escaped Markdown. Strict Anthropic
  schema enforcement and Markdown validation now catch these cases.
- The proposed task update was reviewed and reconciled with actual test results;
  it was not applied blindly. Model output can still contain inaccurate statements.
- Full verification details: docs/verification.md.

### Next milestone: Phase 2
- Select PR base/head and push before/after commits from GitHub events.
- Add PR comments and controlled writes to .context/active-task.md.
- Add bot commits with loop prevention and clear permission boundaries.
- Verify the hosted Action end to end. GitHub workflows are not installed by Phase 1.
