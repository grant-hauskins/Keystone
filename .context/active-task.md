# Active task

## Phase 1: Standalone evaluation pipeline
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
