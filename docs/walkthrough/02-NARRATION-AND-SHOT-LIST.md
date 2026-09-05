# Six-minute onboarding script

Target duration: about six minutes with pauses. Times are editorial targets. Use a disposable demo repository with two committed revisions, committed CLAUDE.md and .context/active-task.md, and a simple change such as a friendlier welcome message. Do not use private production data.

Pause recording during real credential entry. Use large terminal text. Any fabricated or simulated result must be labeled “Illustrative example.” No real successful cloud-save footage is supplied by this kit.

## 00:00–00:30 — Understand the workflow

Visual: title “Your first Keystone review,” followed by committed changes → inspect → review → save.

Narration: “Your agent has changed the code. Keystone helps you understand what changed and whether the work appears to follow your project's rules. We'll enter an AI key, inspect a project, read a review, and save a record. Then we'll see how another agent can connect to Keystone.”

## 00:30–01:20 — Enter the key in Keystone

Visual: begin with the updated Keystone TUI already open. Highlight AI provider, then AI API key directly below it. Open the masked editor. Pause capture for real entry, then show the resulting session notice. Select Model.

Narration: “Choose your AI provider first. Open AI API key and paste only the key, without quotes. Press Enter to set it for this session. Keystone hides the input and doesn't save it to disk or the database. Each provider keeps its own session key. The Model field is separate: it takes a model ID available to your account. A key-available message means a key is present; it doesn't prove your account can make the request.”

## 01:20–02:00 — Find your way around

Visual: move the selection with Up/Down; open and cancel an ordinary editor. Switch views with Tab and scroll using Page Down. Show ? help briefly.

Narration: “Use the arrow keys to select a menu item and Enter to open it. Tab moves between the views, and Page Down scrolls longer results. Escape cancels an edit. The menu also scrolls, so database controls may be farther down. If you need a reminder, press question mark for help. Your project files aren't changed simply by browsing.”

## 02:00–02:45 — Select and inspect the project

Visual: Repository → demo folder. Show committed root CLAUDE.md and .context/active-task.md. Select Comparison and Inspect changes. Browse Files and Diff.

Narration: “Choose the local project you want reviewed. Keystone can be installed in a different folder. The project needs committed rules in CLAUDE.md and a committed current task in .context/active-task.md. The .claude folder doesn't replace those files. Select a range that includes the code work. Latest commit only covers the last commit; widen it if your last commit only added context. Inspect changes is local and makes no AI request. Check the commits and files before proceeding.”

## 02:45–03:30 — Review and interpret

Visual: Run AI review confirmation, then Overview, Findings, and Task. Label any cut over processing time. Keep PROPOSED TASK UPDATE and its suggestion-only note visible.

Narration: “Run AI review shows the provider and inspected commits before sending them. Confirm when you're ready; API charges may apply. Read the summary and findings, then inspect the proposed task update. These are advisory conclusions, so have your agent verify important claims. The Task view is a proposal. Keystone has not edited your task file or made a commit.”

## 03:30–04:40 — Sign in and save a database record

Visual: begin with database configuration already complete. Choose Password sign-in if needed, with capture paused during real credential entry. Show Repository label and Save to database. If no authenticated demo footage is available, use instruction cards rather than simulated success footage.

Narration: “Your database connection is already set up. If you're signed out, select Password sign-in and use your Keystone account. Set a stable repository label, such as your project owner's name followed by the repository name. Use the same label each time so the history stays together. Choose Save to database to store this report. Keystone confirms success afterward and shows the record ID. You can also save an inspection without an AI review; that record will clearly say no AI review was performed. If you see an error, follow its message instead of assuming the save succeeded.”

## 04:40–05:15 — Records and next steps

Visual: actual saved ID if a real save occurred; otherwise a card titled “What to check after saving.” Show Load history and the History view. Briefly point to Save report as the JSON option.

Narration: “After the save succeeds, Keystone confirms it and displays the record ID. Load history shows your latest records for that repository label. If a save fails, don't treat it as confirmed. JSON export is still available through Save report. Both formats store review records; your current task still lives in .context/active-task.md. Have your agent verify findings, make authorized fixes, update task context, commit, and inspect the next range.”

## 05:15–06:00 — Connect another agent

Visual: show a prepared, already-connected agent conversation with the example prompts from the agent-use guide. Label illustrative conversation text. Do not show installation or connection settings.

Narration: “With your agent already connected to Keystone, ask it to inspect the intended changes and explain what it found. When ready, ask it to run a review with your chosen provider and model. Ask it to save the result and tell you the confirmed record ID, then check history. The agent works through Keystone tools instead of asking you to move files around. Keep credentials out of the conversation. MCP does not automatically read every agent conversation or apply task proposals. Ask your agent to verify the findings before making authorized changes.”

## Producer notes

Use only exact menu names from 01-PRODUCT-FACTS. The walkthrough starts with Keystone and its connections already set up. Do not show shells, installation commands, database administration, email-provider configuration, or MCP configuration files. The two usage guides provide additional detail on records and connected-agent requests.
