# Metaprompt: make an existing repository Keystone-compatible

Copy this entire document into the coding agent that will work on the target repository. Fill in the two paths below. The agent should perform the work and verify it, not merely describe a plan.

---

## Your assignment

You are onboarding an existing repository to Keystone. Preserve the project's purpose, rules, implementation, and useful documentation. Make its existing instructions and scaffolding usable by Keystone and by future coding agents.

**Target repository:** `<absolute local path to the repository being onboarded>`

**Keystone installation:** `<absolute local path to the Keystone repository>`

**Scope:** documentation and context migration, a local onboarding branch, and a local dry-run check. Do not add product features, implement pseudocode, change dependencies, deploy, push, merge, or install GitHub workflows unless the user separately requests that work.

If either path is missing, ask for it. Do not guess a repository or search unrelated folders. Follow applicable system/developer instructions and the user's stated permissions throughout this task.

## Record confirmation requirement

After successfully creating or updating durable context/task records or saving a Keystone report, explicitly confirm what was saved and its destination. The user's preference is confirmation **after saving**, not an extra approval prompt before an already-authorized write. Distinguish local files, local commits, and remote publication. If a write fails, report the failure and never claim the record was saved.

This notification preference does not authorize unrelated changes, destructive overwrites, external submissions, or publishing. Follow the scope and permission rules elsewhere in this prompt. Ordinary read-only inspection and transient test fixtures do not require user-record notifications.

## Understand the current contract before editing

Keystone's local pipeline currently:

1. Reads a committed Git comparison, using a three-dot diff.
2. Reads project rules from root `CLAUDE.md` at the comparison **base**. If the base has no rules file, it falls back to the evaluated head and reports a bootstrap warning.
3. Reads committed Markdown files recursively under `.context/` at the evaluated **head**. A nonempty `.context/active-task.md` is required.
4. Can ask Anthropic or OpenAI for an advisory audit, plain-English summary, and proposed replacement task document.

Important consequences:

- A task file that exists only on disk, is ignored, or is merely staged is not enough. It must exist in the commit being evaluated.
- `CLAUDE.md` and context files must be regular files, not symbolic links.
- `.context/active-task.md` is the single source of truth for **current task state**. Do not create a second active-task file with a different spelling or location.
- `AGENTS.md`, README files, design documents, and linked files outside `.context/` are not automatically included as full context. Keystone does **not** follow links or import references from `CLAUDE.md`.
- Put essential, auditable rules directly in `CLAUDE.md`. Links alone are insufficient for those rules.
- Every committed `.context/**/*.md` file may be sent to the selected model provider. This directory is not a private archive.
- Inspection/dry-run makes no API call. It does not prove that an AI audit passed.
- The current CLI and terminal interface do not automatically apply task updates, rewrite rules, post PR comments, or create bot commits. A separate feedback-triage agent is planned, not implemented.
- The target repository may use any language. Do not convert it to TypeScript or install Keystone's dependencies inside it. Keystone runs from its own installation.

Check the installed Keystone README and code if the implementation has changed. Report a material difference and adapt the checks to the actual version; never claim a planned feature is available.

## Step 1 — Inspect without changing anything

Perform these checks in the target repository:

```text
git rev-parse --show-toplevel
git status --short
git branch --show-current
git rev-parse HEAD
```

Record the repository root, current branch, current commit, and existing staged/uncommitted files. Save the current commit as `BASE_SHA`; it will anchor the onboarding comparison. If there are no commits, record that explicitly and use the empty-repository exception in Step 7.

Read applicable `AGENTS.md` instructions, root `CLAUDE.md`, README, and existing `.context/` files. Then locate the project's relevant plans, decision logs, architecture documents, contributor instructions, task lists, agent prompts, pseudocode, scaffolding notes, and known-debt inventory. Inspect enough source/build configuration to distinguish implemented behavior from plans.

Respect scope restrictions you find, including project freezes and requirements to audit before changing application code. This assignment does not authorize application-code changes.

**Do not stash, reset, clean, discard, or automatically commit someone else's work.** Do not overwrite a file that has pre-existing user changes. If such a file must change, explain the exact conflict and ask for that narrow decision while finishing independent work.

Do not read or print credential values. Exclude secrets and sensitive runtime data from the onboarding content.

## Step 2 — Classify existing material before moving or rewriting it

Create `docs/keystone-onboarding.md` as a short migration record, or update an existing equivalent record. For each relevant source, record its path, role, decision, and destination. Use a short bullet per source. If the repository has a different documentation convention, follow it and record the chosen path.

Apply these rules:

**Binding project rules** — Preserve them. Put a concise, directly readable version of essential rules in root `CLAUDE.md`. Examples: no new features, required checks, dependency boundaries, files that must never be committed. Do not copy Keystone's own product rules into an unrelated project.

**Current task and unfinished work** — Summarize the actual current assignment in `.context/active-task.md`. Preserve unresolved blockers and acceptance criteria. Do not promote the entire backlog into the active task.

**Stable design and historical decisions** — Keep their detailed source documents in the project's existing documentation location. Reference them from the task when useful. Include a short factual summary in context only when it is necessary to understand the current change.

**Future scaffolding and pseudocode** — Keep it as a proposal. Label it clearly as `Planned — not implemented` unless source inspection proves otherwise. Keep interfaces, diagrams, invariants, and useful intent. Do not implement it, delete it as obsolete, or claim it is working merely because a file or stub exists.

**Old session prompts or competing task files** — Preserve useful history. Move the current task summary into the canonical file. Where safe, replace only the obsolete current-status section with a pointer to `.context/active-task.md`. Do not erase the rest of the document. Do not maintain two editable versions of current task state.

**Agent entry points such as `AGENTS.md`** — Keep them so the relevant agent can still discover instructions. Add a concise instruction to read root `CLAUDE.md` and `.context/active-task.md` before starting, and to update the canonical task after completing a feature. Preserve agent-specific commands and constraints. Do not replace the whole file with a generic template.

**Conflicting instructions** — Do not silently choose a winner or merge contradictory statements. Identify the exact source passages and which decision is blocked. Follow any clear instruction precedence already established by the user/environment. Otherwise preserve the originals, record the conflict, and ask the smallest necessary question. Do not mark the conflicting portion migrated until resolved.

**Uncertain claims** — Label them `Unverified` and state what evidence is missing. Never turn a proposed capability into an established rule or verified fact.

Example conversion:

```text
Existing note:
  "Future agent: replace the storage layer with PostgreSQL.
   Pseudocode: migrate_records(); validate(); switch_reads();"

Correct treatment:
  Keep the note as a planned migration in its design document.
  Record that no implementation or successful migration was verified.
  Mention it in active-task.md only if the current user requested that migration.
  Preserve any existing rule requiring a storage abstraction in CLAUDE.md.

Incorrect treatment:
  Add a database dependency, create a migration, claim PostgreSQL is in use,
  or place this speculative change in the current acceptance criteria.
```

Do not create extra context files just to copy all existing documentation into `.context/`.

## Step 3 — Prepare root CLAUDE.md

If the file exists, edit it conservatively. Preserve substantive rules and links. If it does not exist, create it using facts established in Step 1.

It should directly state:

- The repository's purpose and scope, including any freeze or excluded features.
- Its actual build, test, and validation commands. If there are no automated tests, say so. A command that runs zero tests must not be described as test coverage.
- Important architectural constraints and prohibited changes.
- Which files or data must not be committed or sent to an external model.
- The following context practices, adapted without weakening existing rules:

```markdown
## Context practices
- Read CLAUDE.md and .context/active-task.md before starting work.
- Use .context/active-task.md as the single source of truth for current task state.
- Before coding, record the task's goal, scope, acceptance criteria, and known blockers.
- After each completed feature, record what changed, what was checked, the actual result, and what remains.
- Distinguish planned work, implemented behavior, and verified behavior.
- Keep secrets, private transcripts, and unnecessary sensitive data out of context.
- Treat model reviews as advisory. Verify factual claims before accepting them.
- Review proposed context updates before applying them. Never let a model silently weaken project rules.
```

Do not replace project-specific constraints with vague guidance such as “follow best practices.” Keep essential rules self-contained: Keystone does not load the contents of linked documents automatically.

## Step 4 — Create or reconcile the canonical task file

Use exactly `.context/active-task.md`, with ordinary UTF-8 text and real Markdown line breaks. Do not use literal `\n` text or an absolute path specific to your own machine inside the document.

If an active task already exists, preserve its valid goals and blockers. For onboarding, add a clearly bounded compatibility task or update the existing task with the user's actual scope. If the current priority is unclear, use documentation onboarding as the task; do not invent product work.

Use this structure, replacing every placeholder with established facts:

```markdown
# Active task

## Task
<One concrete assignment.>

## Status
<In progress, blocked, or complete; explain any qualification.>

## Goal
<The intended outcome in plain English.>

## Scope
- <What this task includes.>
- <Important exclusions or project constraints.>

## Acceptance criteria
- [ ] <Observable result.>
- [ ] <Required verification.>

## Relevant existing behavior and decisions
- <Established fact, with a repository-relative source path.>
- <Relevant constraint. Distinguish plans from implementation.>

## Changes completed
- <Actual completed work, or "None yet.">

## Verification
- <Command/check, result, and the commit or work state checked.>
- <Anything not run, and why.>

## Blockers and unresolved questions
- <Known blocker or "None identified.">

## Next step
<The next bounded action; do not invent a new feature.>
```

Keep this file concise. Link to detailed plans instead of copying them. An optional short `.context/decisions.md` is appropriate only if those decisions are needed in the model's input. Do not duplicate the task there.

## Step 5 — Connect future-agent instructions and preserve traceability

Update applicable agent entry points where they are clean and safe to edit. For example, append this short section to an existing `AGENTS.md` without deleting its current instructions:

```markdown
## Keystone context
Read root CLAUDE.md and .context/active-task.md before working.
The canonical task file contains the current goal, scope, progress, checks, and blockers.
Keep completed history and future proposals in their existing documentation locations.
After completing a feature, update the canonical task with actual changes and verification.
A Keystone report proposes an update; review it before applying it.
```

Do not add `AGENTS.md` solely because this example exists if the repository uses another agent entry point. Ensure at least the applicable entry point or contributor documentation explains the canonical path.

Finish the migration record with:

- Which sources were retained, summarized, or given a canonical-task pointer.
- Which proposals remain unimplemented.
- Any conflicts, intentionally unmigrated material, or pre-existing user edits left untouched.
- The exact files changed by this onboarding task.

Preserve the original source of important decisions. Do not convert a historical decision into a new current task without user direction.

## Step 6 — Check the files before committing

Confirm all of the following:

- Root `CLAUDE.md` exists and contains nonempty, project-specific rules.
- `.context/active-task.md` exists, is nonempty, and describes the actual task.
- Both are regular files, not links. Their spelling and capitalization are exact.
- Neither file is ignored. Investigate an ignore rule before changing it; do not blindly force-add files.
- No second document claims to be the authoritative editable current task.
- Current instructions do not contradict one another without an explicit unresolved-conflict note.
- No credential values, private session logs, customer data, or hidden prompt instructions were copied into context.
- All `.context/` Markdown is suitable for provider submission; remove unnecessary copied material from your new changes, preserving original documentation.
- The diff contains only intended documentation/context changes. Application behavior and dependencies remain unchanged.

Current input limits are 250,000 bytes for the diff, combined context, and final serialized model input, with a separate 2 MB Git-output buffer. Keep rules and task context comfortably below these limits. Dry-run does not currently enforce the final combined model-request size; a dry-run pass alone does not guarantee that a live request fits.

Run `git diff --check` and inspect your exact diff. Do not run unrelated build/install processes just to claim validation for a documentation-only migration, unless the repository requires those checks. Never claim checks you did not run.

## Step 7 — Commit the onboarding files and verify with Keystone

Create a local onboarding branch when appropriate. Use a new available branch name; do not reset an existing branch. Keep the recorded `BASE_SHA` from Step 1.

Stage only the files this task intentionally changed. Inspect the staged diff and commit only those paths. If unrelated files were already staged, use an isolated worktree or an explicit path-limited commit so they cannot be included. Do not use `git add .`, `git add -A`, or a blanket commit when other work is present.

After committing, obtain the evaluated head with `git rev-parse HEAD`; call it `HEAD_SHA`. Check that its tree contains the required files:

```text
git ls-tree HEAD -- CLAUDE.md .context/active-task.md
```

Run Keystone from its own installation. Substitute real paths and the actual recorded SHAs; do not type the angle-bracket placeholders literally:

```powershell
node "<KEYSTONE_PATH>\build\cli.js" --repo "<TARGET_PATH>" --base "<BASE_SHA>" --head "<HEAD_SHA>" --dry-run
```

If the compiled entry point does not exist, follow the installed Keystone README to install/build Keystone in its own directory first. Do not install it into the target application. The terminal interface, when available, can perform the same check: select the target folder, set the custom base and head, and choose **Inspect changes**.

Verify the actual result:

- The command exits successfully.
- The report identifies the intended repository changes and exact commit range.
- `contextFiles` includes `.context/active-task.md`.
- `rulesSource` is the expected base commit or a documented bootstrap fallback.
- The status is `dry-run` for a nonempty comparison. `evaluation` is `null`; this is correct because no model ran.
- Any warning about uncommitted files is reconciled with the files recorded in Step 1. Do not commit them merely to eliminate the warning.

**Empty repository exception:** If no prior commit existed, commit the required documentation as the initial baseline. A comparison of that commit to itself can verify context loading but returns `no-changes`. Report this as an empty-range setup check, not a changed-code audit. Do not manufacture application changes or rewrite history to produce a nonempty diff.

**Do not reuse `HEAD~1` blindly.** Adding a task or verification commit changes what `HEAD~1` refers to. Use the recorded SHAs to avoid accidentally checking only a setup commit. Future feature reviews should use a base that already contains the adopted rules.

If the dry run fails:

- `Missing committed .context/active-task.md`: inspect the evaluated head's tree. Check the exact path, ignore rules, and whether the file was committed.
- Missing `CLAUDE.md`: add/reconcile and commit real project rules; do not substitute an empty placeholder.
- Unavailable revision: check the path, history, and selected SHAs. Fetch only the needed remote history when authorized.
- Oversized input: select a smaller, explicitly reported comparison or reduce unnecessary new context. Do not silently drop files or claim the original scope was reviewed.

Update the canonical task with the real verification outcome and commit that documentation update separately if needed. Record which commit was tested; do not claim a later documentation commit was included in an earlier test.

A live model call is optional and is not required for documentation compatibility. Before making one, confirm that external submission of the selected code/context and API usage are authorized. Use environment credentials, never a token in a prompt, command argument, document, or commit. Keep “setup verified,” “live provider tested,” and “application behavior verified” as separate claims.

## Step 8 — Leave clear instructions for ongoing use

Include this routine in the repository's contributor or agent instructions:

1. Read project rules and the canonical active task.
2. Record the current assignment before changing code. Honor any required audit or frozen scope.
3. Keep future pseudocode and backlog items separate from current work.
4. Implement only the authorized change; run the project's applicable checks.
5. Update `.context/active-task.md` with what changed, what was actually verified, and remaining blockers.
6. Commit the intended code and context. Choose explicit base/head commits for review.
7. Inspect with Keystone; run an AI review only when authorized and configured.
8. Check each model claim against the diff, rules, and actual evidence. Keep unrelated suggestions as optional future work. Do not treat the unimplemented feedback-triage agent as available.
9. Review and reconcile a proposed task update before applying it. Preserve unresolved work and do not weaken project rules.
10. Commit any accepted context update and identify the reviewed commit range. Do not claim the new context commit was included in an earlier review.

## Final report you must give the user

Keep the report factual and include:

- The target repository, local branch, and commits created. State that nothing was pushed unless it was explicitly requested and done.
- The documentation/context files changed and why.
- How existing scaffolding and pseudocode were preserved or classified.
- Any unresolved conflicts, pre-existing user changes, or migration gaps.
- The exact Keystone comparison and actual result, including relevant warnings.
- Whether only dry-run was tested or a live provider call also ran.
- Whether application tests were required/run; never imply a documentation check validates application behavior.
- One exact next command or terminal-interface sequence using the user's real paths and selected revisions.

You may call the repository **Keystone-compatible, dry-run verified** only when its required committed files load successfully and you have checked the result. Do not claim automatic synchronization, hosted workflows, or live model verification unless those capabilities were actually configured and tested.
