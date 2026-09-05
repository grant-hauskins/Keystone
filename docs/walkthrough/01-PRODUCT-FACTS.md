# Current Keystone product facts

Authority: current local working tree, especially src/tui/model.ts, src/tui/render.ts, src/storage/supabase.ts, src/mcp.ts, src/mcp/server.ts, and README.md. This edition supersedes the earlier pre-database walkthrough. The changes are local implementation; do not imply they have been published as a release.

## What works

Keystone reads committed changes, root CLAUDE.md rules, and committed Markdown under .context/. It provides local inspection, an optional Anthropic/OpenAI review, plain-English results, advisory findings, and proposed task text.

The TUI can set a masked AI key, export JSON, sign in to Supabase, save a review record, and display history. A local MCP server exposes the same inspection/review pipeline and database storage to connected agents.

## Exact TUI names and controls

Menu, in order: Repository; Comparison; Base revision; Head revision; AI provider; AI API key; Model; Inspect changes; Run AI review; Save report; Database URL; Database key; Email sign-in; Enter sign-in code; Repository label; Save to database; Load history; Sign out; Password sign-in.

Views: Overview; Files; Diff; Findings; Task; History.

Up/Down selects menu items; Enter activates or edits. The menu scrolls when needed. Tab or Left/Right changes views. PgUp/PgDn or j/k scrolls content. i inspects, r requests review, s opens JSON saving, ? opens help, q or Ctrl+C exits. While editing, characters are input rather than shortcuts. Esc cancels an editor. Minimum terminal size: 76 columns by 22 rows.

## Keys and passwords are different things

- AI API key: Anthropic/OpenAI credential, entered in the masked TUI field or inherited from ANTHROPIC_API_KEY/OPENAI_API_KEY. TUI overrides are provider-specific, session-only, and take precedence over terminal values.
- Model: a provider model identifier, never a secret.
- Database key: public connection information for an already-configured Supabase project. This walkthrough does not teach configuration.
- Keystone login password: your separate Keystone account password, used under Password sign-in.
- MCP credentials: separate from a TUI session key. If the connected agent reports missing access, ask the person managing that connection.

Key presence does not verify account access. Keystone does not identify who originally supplied an inherited key.

## Selecting a compatible repository

This walkthrough assumes Keystone is already installed and opens successfully. It can review a project in a different folder.

The reviewed head must include committed .context/active-task.md. Root CLAUDE.md is also required; .claude/ is not a substitute. Rules come from the selected base, with a warned head fallback when bootstrapping. Context Markdown comes from head. Referenced external documents are not automatically followed.

Latest commit uses HEAD~1...HEAD. Branch changes uses origin/main...HEAD, which must exist locally. Custom ranges accept explicit revisions. Three dots compares the common ancestor to head. Uncommitted work is excluded. A context-only latest commit can omit earlier code work, so choose the range deliberately.

For migration, preserve existing useful instructions and scaffolding; reconcile conflicts, distinguish implemented behavior from future plans, and keep current task state canonical in .context/active-task.md. Use the separate adoption metaprompt for full migration guidance.

## Inspect, review, and save

Inspection is local and makes no AI call. A live review sends the inspected changes and context to the selected provider after the TUI confirmation and may incur API charges. It uses the inspected snapshot even if the branch subsequently moves.

Before review, Task displays current committed task text and Findings says no review has run. After review, Task displays PROPOSED TASK UPDATE. Findings are advisory, including a pass.

Save report creates a new JSON file in an existing folder; it never overwrites an existing file. Relative paths resolve from Keystone's launch directory. Save to database uploads the report and stable Repository label to Supabase. An inspection-only record has no AI findings. Reports can contain code excerpts in findings or proposed task text; no raw diff is uploaded as a separate report field.

After successful saving, Keystone confirms the file location or database record ID. It does not claim success before acknowledgement or add an extra save approval after the user has chosen the action. A same-session database retry for the unchanged report reuses its ID. Restarting loses that retry state.

Supabase records are private to the signed-in user. Load history shows the latest 20 for the exact repository label. History leaves the current inspection unchanged. Sign-in tokens are in memory; expired sessions need another sign-in.

## MCP

The local stdio server provides keystone_inspect, keystone_review, keystone_save_record, and keystone_history. Each configured connection targets one repository and label. Do not give credentials to an agent through tool arguments or chat. Only server-created result IDs may be saved. The latest 16 results remain available per connection; restarting invalidates them. Agents should relay successful-save confirmations to the user.

This is not a hosted public HTTP endpoint and does not automatically collect agent conversations.

## Limits and evidence

The full local suite passed 47 tests, including a real MCP client handshake and repository inspection. Provider evaluation and database retries were tested with mocks. The hosted project's public API was reachable and anonymous reads were denied. An authenticated hosted save/read and live two-user isolation check remain unverified. Do not turn a scripted demo into a claim those checks passed.

Automatic context edits, commits, PR comments, shared-team history, and agent-feedback relevance filtering are not implemented. The CLI and Action still use file output. Supabase stores history and proposals; .context/active-task.md remains the current task source of truth.
