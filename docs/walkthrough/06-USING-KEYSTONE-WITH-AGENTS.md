# Use Keystone with an already-connected agent

This guide assumes your agent application already has access to Keystone's MCP tools for the intended repository. It covers what to ask the agent, not installing the connection.

## Start with inspection

Say:

> Use Keystone to inspect the latest committed change in this repository. Tell me which commits and files it includes, and whether the project rules and active task loaded. Do not run an AI review or save anything yet.

The agent should call **keystone_inspect** and explain the result. If you want the whole task rather than the latest commit, tell it the intended base and head. Inspection excludes uncommitted work.

## Request a review

Say:

> Review that inspected snapshot with Keystone using my chosen provider and model. Explain the summary, any rule findings, and what the proposed task update would change.

Use the actual provider and model you intend to use. The agent calls **keystone_review** with the inspection's result ID. This makes an external AI request and may incur charges.

The review uses the inspected snapshot even if the branch has since moved. The returned findings are advisory. If the agent reports missing credentials, have the person managing the connection resolve access. Do not paste keys or passwords into the conversation.

## Save and verify

Say:

> Save that Keystone review to the database. After saving succeeds, tell me the confirmed record ID. Then load history and verify that record appears.

The agent should call **keystone_save_record**, report success only after acknowledgement, and call **keystone_history** to check the record. If saving fails, it should explain the error rather than claim success.

An inspection and its subsequent AI review have different result IDs. Ask the agent to save the evaluated review when that is what you want. The database record ID is returned only by the save operation.

## Use the findings to guide the next change

Say:

> Check Keystone's findings against the code. Address the valid findings within our current task, update .context/active-task.md, and report what you verified. Do not treat historical proposals as new requirements.

The agent's ordinary coding capabilities handle authorized edits. Keystone's MCP tools do not themselves modify the repository or apply task proposals.

## Understand the boundaries

Each connection targets one repository and stable label. If you are working on another project, use its configured Keystone connection.

Only the latest 16 result IDs remain in a connection's memory. Restarting the connection invalidates them. If a result has expired, inspect again. After an uncertain save and restart, check history before repeating it.

The TUI and connected agent have separate sessions. A key entered only in the TUI is not automatically available to the agent's Keystone connection.

MCP does not automatically collect agent conversations or decide which feedback is relevant. Ask for each inspection, review, and save deliberately. The agent should always relay Keystone's after-save confirmation to you.
