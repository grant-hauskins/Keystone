# Terminal interface verification

## Automated checks

`npm test` compiled the application and shipped Action modules, then passed
**32 tests with 0 failures and 0 skipped tests** on Node.js 24.12.0 / Windows.
`git diff --check` passed.

The suite covers the original pipeline plus repository/range editing, missing
context and credentials, snapshot identity when HEAD moves, review cancellation,
late asynchronous responses, JSON export, refusal to overwrite files, after-save
confirmation, failed-save messages, waiting for pending saves on exit, terminal
escape sanitization, narrow-screen layout, scrolling, and non-interactive usage.

The scriptable CLI preserves JSON on stdout and sends save confirmation to stderr.
The Action's report output is tested along with its success notification.

## Interactive checks

Launched the real TUI with `npm start` in a Windows terminal (80 columns).
Selected debate-engine with base `99a5f1d` and head `030b4c02`:

- Inspection loaded three changed files and the committed active task.
- Files and Diff views displayed the expected changes.
- Report export accepted a typed path and created a valid dry-run JSON report.
- The interface displayed `RECORD SAVED SUCCESSFULLY` and the destination after writing.
- Quitting restored the terminal and returned exit code 0.

The target repository was not edited, and no model API call was made in this
interactive smoke test. AI review orchestration was tested with mocked responses;
the earlier Phase 1 live-provider check is recorded separately in verification.md.

## Limits

This is a local terminal interface. Settings do not persist between sessions.
It proposes context updates but does not apply them, create commits, or post PR
comments. Hosted GitHub execution and the feedback-triage agent remain future work.
The interface confirms records after saving; it does not add another approval prompt
to an explicit save action. Live AI calls still show the provider, model, and range
before submission.
