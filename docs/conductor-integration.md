# Keystone inside Conductor

Conductor (`grant-hauskins/conductor`) is the desktop front end of the merged product.
It walks a non-engineer through eight project stages and keeps each project as a small
Git repository. Keystone is the engine underneath: after every save, Conductor runs
Keystone's command line as a child process, and the result appears in Conductor's
**Keystone** tab. Nothing in Keystone knows about Conductor; this document is the
contract Conductor relies on.

## What Conductor commits

For a project whose slug is `garden-buddy`, Conductor maintains `projects/garden-buddy/`
as a Git repository containing:

| File | Content | Why Keystone needs it |
|---|---|---|
| `CLAUDE.md` | Project rules written from the owner's own answers (what it must never do, hard constraints, what the builder must not do) plus standing rules | Keystone audits every change against the rules at the comparison base |
| `.context/active-task.md` | Current stage, completed stages, next step | The canonical task record Keystone requires and proposes updates for |
| `stages/01-idea.md` … `stages/08-ship.md` | Each stage's answers and its output | These are the changes Keystone explains in plain English |
| `README.md` | What the folder is | Hand-off note for an engineering agent |

Conductor writes these files and commits them when a stage is completed, when the
user switches projects, and when the window closes. Nothing is committed when the
rendered files did not change, so a commit always means a real change. The generated
files contain no timestamps for the same reason. The raw answers stay in
`projects/garden-buddy.json`, which Conductor already used; the repository is the
rendered, versioned view.

## How Conductor calls Keystone

Conductor locates a **built** Keystone folder (`keystone.path` in `config.properties`,
otherwise a `keystone` or `../Keystone` folder) and runs `node build/cli.js`:

| Purpose | Command | Environment |
|---|---|---|
| Inspect after a save (no AI call) | `--repo <abs path> --base HEAD~1 --head HEAD --dry-run --include-snapshot` | none |
| AI review, pinned to the inspected commits | `--repo <abs path> --base <base sha> --head <head sha> --provider anthropic\|openai --model <id> --include-snapshot` | `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` |
| Save the displayed report to Supabase | `--save-db --input <report.json> --label <label> --record-id <uuid>` | `KEYSTONE_DB_URL`, `KEYSTONE_DB_KEY`, `KEYSTONE_DB_EMAIL`, `KEYSTONE_DB_PASSWORD` |
| Load history for a label | `--history --label <label>` | same four database variables |

Credentials travel only in the child process environment, never in arguments. Base and
head for a review are the full commit IDs from the inspection report, so the review
covers the commits the user looked at even if the project moved on.

Exit codes: `0` success, dry run, or no changes; `1` operational error with one line
`Keystone: <message>` on stderr and nothing on stdout; `2` an evaluated audit whose
status is `fail` (stdout still carries the full report). `--save-db` prints
`Keystone: Record saved successfully to Supabase: <id>` on stderr and
`{"saved":true,"recordId":"<id>","repository":"<label>"}` on stdout only after the
database acknowledged the record. Retrying with the same `--record-id` verifies the
existing record instead of writing a duplicate.

## Output with `--include-snapshot`

The default report is unchanged. With the flag, one extra field is added:

```json
{
  "version": 1, "status": "dry-run", "base": "…", "head": "…", "mergeBase": "…",
  "rulesSource": "…", "files": ["stages/03-requirements.md"], "contextFiles": [".context/active-task.md"],
  "diffBytes": 1234, "warnings": [], "provider": null, "model": null, "evaluation": null,
  "snapshot": { "diff": "…unified diff…", "rules": "…CLAUDE.md at the base…", "context": { ".context/active-task.md": "…" } }
}
```

Hosts render `snapshot.diff` and `snapshot.context` themselves. A report file that
carries a snapshot is still accepted by `--save-db --input`: validation keeps only the
report fields, so no diff text is stored in the database by that path.

## What stays true

- Keystone never writes to the project repository. Conductor writes and commits; Keystone reads commits.
- Rules come from the comparison base, so a stage that changes the owner's boundaries is audited against the boundaries that were in force before it.
- Inspection makes no API call. An AI review runs only when the user asks, or when they turn on Conductor's opt-in automatic review, which is announced with the stage's call count.
- Proposed task updates are shown, not applied. Conductor regenerates `.context/active-task.md` from project state on the next save.

## Building Keystone for Conductor

```sh
npm ci
npm run build
```

`build/cli.js` is what Conductor runs. It has no third-party runtime dependencies; only
the build step needs `node_modules`. Node.js 22 or later and Git must be on the PATH of
the machine running Conductor.
