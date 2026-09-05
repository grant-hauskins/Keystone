# Accuracy checklist and FAQ

## Before publishing

- [ ] AI API key appears directly below AI provider and is the main onboarding route.
- [ ] Key entry is masked; actual pasted keys have no surrounding quotes.
- [ ] The walkthrough focuses on Keystone usage; no shell or infrastructure setup is shown.
- [ ] No real key appears in commands, video frames, captions, uploads, or narration.
- [ ] TUI overrides are session-only and take precedence over terminal values for that provider.
- [ ] Model is an identifier, not a credential.
- [ ] The selected repository has committed CLAUDE.md and .context/active-task.md.
- [ ] The comparison includes intended code work, not just a documentation-only commit.
- [ ] Local inspection is distinguished from a billed AI review.
- [ ] Findings are advisory; Task output is a proposal, not an applied change.
- [ ] Password sign-in uses the viewer’s already-created Keystone account.
- [ ] Supabase's public project key, login password, AI key, and database password are not conflated.
- [ ] Save to database confirms a record ID only after acknowledgement.
- [ ] Load history is scoped to the current database user and exact repository label.
- [ ] JSON export remains available, and .context/active-task.md remains canonical.
- [ ] MCP is local stdio; it does not share a TUI session key or ingest conversations automatically.
- [ ] Synthetic results are labeled; no unverified hosted save is presented as proven.
- [ ] No roadmap capability is presented as shipped.

## I don't see AI API key

It is directly below AI provider in the updated interface. Close and reopen the updated installation. If the field is still missing, you may be using an older copy.

## Does my key need quotes?

No. In the AI API key field, paste only the key and press Enter. The input is masked. Set AI provider first; Model takes the model ID.

## Will Keystone remember the key?

The in-app key lasts for this session and is separate for each provider. It takes precedence over an inherited key. Press Esc to cancel an edit, or submit the field empty to restore the inherited key if available.

## Key available, but review fails

Presence is not validation. Match provider and model, check account API access and billing, and read the error. Do not paste the key into Model or share it while troubleshooting.

## What makes a repository compatible?

Committed root CLAUDE.md and committed .context/active-task.md at the appropriate revisions, plus a valid comparison. The folder tree alone cannot prove this. Inspect changes validates readiness without an AI key or database sign-in. Keep historical scaffolding and future plans clearly distinguished from active requirements.

## Which password does Password sign-in use?

Use your separate Keystone account password. Do not enter your mailbox password, database password, or AI API key there. This guide assumes your account and connection have already been set up.

## I saved JSON. Is it in Supabase too?

No. Save report writes JSON locally. Save to database writes a database record. Each success message identifies its destination. Neither action edits .context/active-task.md.

## My database save lost its connection

Retry without changing or re-inspecting the report in the same session. Keystone reuses its record ID and checks an existing record for equality. After restarting, inspect history first because retry state is not persisted. Do not claim a save occurred without acknowledgement or a verified matching record.

## Why can't the agent use my TUI key?

MCP runs as a separate process. A key entered only in the TUI is not shared with a connected agent. If its Keystone tools report missing credentials, ask the person managing the connection to resolve access; do not paste secrets into the conversation.

## Does an MCP save update the task automatically?

No. The agent receives a record ID after successful saving and should relay that confirmation to you. Task proposals still need verification and authorized application. The server exposes no repository-writing tool.

## What has actually been verified?

The local suite passed 47 tests, including real MCP discovery and inspection. Hosted public API access and anonymous denial were checked. Authenticated hosted save/read and live multi-user isolation remain unverified. The walkthrough kit itself contains no recorded live audit or cloud save.
