# Producer prompt — current edition

Create a beginner onboarding video titled “Your first Keystone review” from this updated source library. Replace earlier source material: it incorrectly describes the current build as lacking an AI-key editor, Supabase storage, and MCP. Target roughly six minutes, with calm English narration and readable controls. Use the supplied script and shot list.

Required sequence:
1. Explain committed changes → local inspection → optional AI review → saved record.
2. Demonstrate AI provider → AI API key → Model. The key field is masked, provider-specific, and session-only. Actual pasted keys do not need quotes. A key being present does not establish validity.
3. Demonstrate navigation inside Keystone: arrow keys, Enter, Tab, scrolling, Esc, and help.
4. Explain committed CLAUDE.md and .context/active-task.md and choosing a meaningful comparison. The .claude directory is not a substitute for root rules.
5. Inspect before review. Explain the external provider request and possible charges, then Overview, Findings, and the unapplied Task proposal.
6. Start with the database already configured. Show Password sign-in if needed, then a stable Repository label. Keep real credentials off-screen.
7. Do not cover infrastructure setup, database administration, SMTP, or account creation.
8. Show Save to database, confirmation after acknowledgement, record ID, and Load history. Mention JSON export remains available through Save report.
9. Show how to ask an already-connected agent to inspect, review, save, and report a confirmed record ID. No MCP installation or configuration.
10. Explain that canonical task context remains in .context/active-task.md and agent review of proposals is still needed.

Production requirements:
- Use generic demo repositories and paths. No actual credentials or personal data.
- Pause recording during real credential entry; illustrative input must be clearly fake and labeled.
- Use authentic footage only when supplied. Otherwise use diagrams/instruction cards, not fabricated product screens.
- Label simulated audit and save results “Illustrative example.” Do not claim a hosted authenticated save succeeded: that remains unverified in supplied evidence.
- Do not invent automatic task sync, commits, PR comments, shared-team history, Gemini as an AI review provider, a hosted public MCP endpoint, or conversation ingestion.
- Do not say all settings persist. AI overrides and login tokens are session-only; public Supabase connection details persist locally.
- Preserve exact strings: AI API key, Password sign-in, .context/active-task.md, ANTHROPIC_API_KEY, OPENAI_API_KEY, HEAD~1, and MCP tool names.
- Focus solely on using Keystone. No PowerShell, shell commands, environment-variable recipes, installation steps, or connection configuration.
- Include the confirmed-save notice only after a successful write; no extra approval after an explicitly submitted save.
- Review against the quality checklist before delivery.

Deliver an actual video only if your tool can render one. Otherwise provide narration, captions, and editing instructions and state clearly that no video was generated. Duration is a pacing target, not a reason to omit clear in-app instructions.
