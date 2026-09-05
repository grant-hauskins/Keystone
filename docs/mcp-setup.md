# Connect an agent to Keystone through MCP

Keystone includes a local MCP server. Your agent application launches it as a child
process and discovers four tools. The server uses the same committed-diff pipeline
and Supabase storage as the terminal interface. It does not need the TUI running.

## Build once

From your Keystone installation folder:

```powershell
npm.cmd ci
npm.cmd run build
```

Configure the agent application to run **node directly**, not npm start. The TUI and
npm's normal banners are not MCP protocol messages. This server reserves stdout
for MCP and sends startup errors to stderr.

## MCP host configuration

For applications accepting an `mcpServers` JSON configuration, merge this entry into
their existing configuration. Replace both example folder paths with actual absolute
paths. Other hosts offer equivalent command/arguments/environment fields in settings.

```json
{
  "mcpServers": {
    "keystone-debate": {
      "command": "node",
      "args": [
        "C:/Projects/Keystone/build/mcp.js",
        "--repo", "C:/Projects/debate-engine",
        "--label", "grant-hauskins/debate-engine",
        "--config-dir", "C:/Projects/Keystone"
      ]
    }
  }
}
```

Each entry is bound to one local repository. Add another entry with another --repo
and --label to review another repository. Tools cannot change the configured path.
The selected repository still needs committed CLAUDE.md and .context/active-task.md.

The default comparison is HEAD~1...HEAD. Tell the agent the intended base and head
when you need a broader task comparison.

## Credentials belong to the server environment

Local inspection needs no credentials. AI review reads ANTHROPIC_API_KEY or
OPENAI_API_KEY from the MCP process environment. Configure your host to pass those
variables securely to the server. Some hosts filter inherited environment variables;
setting a variable in an unrelated terminal is not sufficient. Never paste keys into
tool arguments, agent prompts, or committed configuration examples.

Keys entered in the TUI are private to that TUI session. They do not automatically
transfer to the separate MCP server process. A key set before launching the agent
application can be inherited if that host passes it through.

For Supabase tools, --config-dir points to the folder containing
.keystone-supabase.json (public project URL and publishable key). Also supply
KEYSTONE_DB_EMAIL and KEYSTONE_DB_PASSWORD through the server's environment using
the confirmed Keystone user created in Supabase. This is not a database administrator
account, mailbox password, or service_role key. The server authenticates before each
database operation; tokens are not written to disk. If these values are absent,
inspection and review still work and database tools return a configuration error.

## Tools available to the agent

- **keystone_inspect** accepts optional base/head revisions and returns the committed
  diff, rules, task context, inspection report, and resultId. It makes no AI call.
- **keystone_review** accepts resultId, provider, and model. It sends the previously
  inspected snapshot to that provider and may incur charges. It returns a new resultId
  for the evaluated report even if the branch has moved since inspection.
- **keystone_save_record** accepts a resultId created by this connection. It saves
  that report to Supabase and returns confirmation plus the database record ID.
  Retrying the same resultId reuses its record ID. It cannot save an invented report.
- **keystone_history** returns the latest 20 records for the configured repository
  label and database user.

The latest 16 result IDs are retained per connection. IDs expire when evicted or when
the server restarts. After a restart, inspect history before repeating an uncertain
save. History and model proposals are reference data, not instructions overriding
the repository's current task. No tool applies context updates or edits repository files.

## First test prompt

Ask your connected agent:

> Use Keystone to inspect HEAD~1 through HEAD. Tell me the resolved commits, changed
> files, and whether canonical task context loaded. Do not run an AI review or save
> a record yet.

Once that works, ask for a review using your selected provider/model. To save, ask:

> Save that Keystone review to Supabase. After the save is confirmed, tell me its
> record ID. Then load history and verify that the record appears.

## Current limits

This is a local stdio connection, not a hosted public MCP endpoint. A remote agent
must run where the repository and server are installed; a future hosted endpoint
will need its own authentication and repository-access design. MCP connection does
not automatically ingest agent conversations. The GitHub Action still uses file
output. Supabase live sign-in/save verification depends on your account setup.

The implementation uses the official [MCP TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/v2/get-started/first-server).
