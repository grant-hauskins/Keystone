# Keystone walkthrough kit — updated edition

This kit describes the current local working build, including the AI key editor, Supabase storage, and MCP server. It replaces the earlier kit describing commit 57455c1. It contains production material, not a rendered video or captured footage.

## Easiest way to enter your AI key

1. Open the updated Keystone interface.
2. Select **AI provider** and choose Anthropic or OpenAI.
3. Select **AI API key**, directly below **AI provider**, and press Enter.
4. Paste only the actual key, **without quotes**, then press Enter. The input is masked.
5. Set **Model** to a model ID available to that provider account.

The key overrides that provider's terminal key for this TUI session. It is not saved to disk or Supabase. Each provider has its own session key. Esc cancels editing. To remove an override, open the field and submit it empty; Keystone then uses the terminal key if one is available.

“Key available” or “key set” does not prove the credential is valid. The real API request tests access. Anthropic being selected by default does not mean Keystone created a key.

## Use your configured database and agent connections

The walkthrough starts after setup. Choose **Password sign-in** to sign in with your Keystone account if needed. Then use **Save to database** and **Load history**. See **05-USING-SUPABASE.md**.

For an agent already connected through MCP, use the prompts in **06-USING-KEYSTONE-WITH-AGENTS.md**. This kit does not cover installing or configuring the connection.

## Make the video in NotebookLM / Gemini Notebook

1. Remove the old Keystone source from the notebook, or create a fresh notebook, so conflicting versions are not mixed.
2. Copy **NOTEBOOKLM-SOURCE.txt** into a pasted-text source. Do not upload the ZIP as a source.
3. Open **Studio → Video Overview** and choose Explainer if offered.
4. Use **03-VIDEO-GENERATION-PROMPT.md** as the custom instructions.
5. Generate, review against **04-QUALITY-CHECK-AND-FAQ.md**, correct inaccuracies, and download the result.

Google documents [pasted-text sources](https://support.google.com/gemininotebook/answer/16215270?hl=en) and [Video Overviews](https://support.google.com/gemininotebook/answer/16454555?hl=en). Controls vary by account; duration is a production target. A generated overview may illustrate the workflow without reproducing actual screens.

For exact screen footage, record the actions in the shot list. Give those clips and this kit to a video editor. A text-only model can prepare narration and captions but may not render video.

## Contents

- 01-PRODUCT-FACTS.md — current capabilities and boundaries.
- 02-NARRATION-AND-SHOT-LIST.md — six-minute script and recording instructions.
- 03-VIDEO-GENERATION-PROMPT.md — copyable producer prompt.
- 04-QUALITY-CHECK-AND-FAQ.md — accuracy checks and common problems.
- 05-USING-SUPABASE.md — sign in, save records, and read history.
- 06-USING-KEYSTONE-WITH-AGENTS.md — prompts for an already-connected agent.
- NOTEBOOKLM-SOURCE.txt — all source material combined.

No real credentials, private repository content, or authenticated review recordings are supplied.
