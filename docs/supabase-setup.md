# Supabase setup and first saved record

Keystone's TUI supports Supabase sign-in, saving reports, and reading the latest
20 records for a repository label. JSON export remains available. The command line
can save an existing report and read history unattended with `KEYSTONE_DB_*`
environment variables (see the README); this is how Conductor's Keystone tab saves.
The GitHub Action still writes files only.

## One-time dashboard setup

1. Create a Supabase project with the Data API enabled. Keep automatic exposure of
   new tables off; the migration grants the specific access Keystone needs.
2. Run `supabase/migrations/202609050001_review_records.sql` once in the SQL Editor,
   or deploy it through your migration workflow. It creates `keystone_reviews`,
   enables row-level security, and permits authenticated users to insert and read
   only records belonging to their account. It grants no client update/delete access.
3. For the simplest first test, go to Authentication → Users → Add user → Create new
   user. Enter your email and a new, separate Keystone password; enable Auto Confirm
   User if offered. Keep that password in your password manager. It is not your email
   mailbox password, Supabase dashboard password, or database password. Use the TUI's
   Password sign-in option. No SMTP configuration or email delivery is required.

## Optional email-code sign-in

New Free projects using Supabase's default email sender cannot customize email
templates (a restriction introduced June 3, 2026). Configure custom SMTP before
using the code flow on those projects. The default team-member email allowance does
not remove this template restriction. Password sign-in above avoids this requirement.
See [Supabase's announcement](https://supabase.com/changelog).

With a custom sender configured, go to Email Templates → Magic Link,
and add this line to the body and save (the existing link may remain):

   ```html
   <p>Your Keystone sign-in code is: {{ .Token }}</p>
   ```

   Paste that exact placeholder, including braces. Supabase replaces it with a code.
   Resend is one supported sender with a Supabase integration. A verified sending
   domain is normally part of that setup. Do not put your usual mailbox password in
   SMTP settings; use credentials issued by the selected sending service.

Sources: [Supabase passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless),
[email delivery](https://supabase.com/docs/guides/auth/auth-smtp), and
[Resend integration](https://resend.com/supabase).

## Configure Keystone

Launch with `npm.cmd start` from the Keystone installation folder. Scroll down the
left menu with the arrow keys; the menu scrolls on smaller terminals.

Enter **Database URL** and **Database key** using the project's HTTPS URL and
`sb_publishable_...` key. These are public connection details, not the database
password. Never enter a `service_role`, secret key, or database password here.

Both settings are saved in `.keystone-supabase.json` in Keystone's launch folder,
which Git ignores. This file contains only `url` and `publishableKey`. The current
Grant workstation has already been configured with the supplied project details.
Launch from that same folder to load them. Other installations configure their own
connection through the menu.

For the first test, choose **Password sign-in** (scroll to the bottom of the menu).
Enter your new Keystone user's email, then its password. The password input is masked
and is discarded after submission. A successful login displays “Signed in.”

If you configured the optional code flow, choose **Email sign-in** and enter your email. Submitting it requests a sign-in code
and may register a new Supabase Auth user. Choose **Enter sign-in code** and paste
the code from the email. The input is masked. A successful verification displays
“Signed in.” Keep the code in the app; do not send it to another agent.

Login tokens remain in memory, not in the configuration file. Exiting the TUI or
choosing Sign out forgets the local token. This does not revoke other sessions.
Expired sessions require another sign-in; automatic refresh is not implemented.

## First database test without an AI call

1. Select a repository with committed CLAUDE.md and .context/active-task.md.
2. Select a valid comparison and choose **Inspect changes**. This makes no AI call.
3. Set **Repository label** to a stable identifier such as `grant-hauskins/Keystone`.
   Use the same label on other machines. The default folder name is only a starting
   value; different repositories should have distinct labels.
4. Choose **Save to database**. This uploads the report and label. It does not upload
   the raw diff as a separate field; an AI report can contain code excerpts in its
   findings and proposed task text. Provider API keys and sign-in tokens are not
   included in the record.
5. Wait for **RECORD SAVED SUCCESSFULLY** and a Supabase record ID. This appears only
   after the database acknowledges the save. There is no extra approval prompt.
6. Choose **Load history**, then read the **History** view. Use PgUp/PgDn or j/k to
   scroll. Confirm the new ID appears. Inspection-only records explicitly say no AI
   review was performed. The current inspected snapshot is left unchanged.

A network failure can occur after the server saves but before the acknowledgement
arrives. Retry without changing or re-inspecting the report: Keystone reuses its ID
and verifies an identical existing record instead of overwriting it. That retry ID
lasts only for this TUI session; after restarting, inspect history before saving again.

After this test, run an AI review and save its result the same way. The provider key
still comes from ANTHROPIC_API_KEY or OPENAI_API_KEY; database credentials and AI
credentials are separate.

## What stays canonical

The database stores historical records and proposed task updates. It does not replace
`.context/active-task.md`, apply a proposed task, edit rules, or commit to the reviewed
repository. Each record includes the committed range, server timestamp, and report.
Records are private per signed-in user; shared team access is not implemented.

## Troubleshooting

- **No email:** use your organization's member email, check spam and Auth logs,
  and account for the built-in sender's rate limit. An HTTP success means the request
  was accepted, not proof that delivery completed.
- **Only a link or template editor blocked:** use Password sign-in for the first test.
  For code sign-in, configure custom SMTP and add `{{ .Token }}` to the Magic Link body.
  Previously sent emails will not change.
- **Save denied:** confirm the migration completed, then sign in. The publishable key
  alone cannot access records. Keep RLS enabled.
- **Invalid configuration:** correct or remove `.keystone-supabase.json` in the launch
  folder and restart. Use a hosted `https://project.supabase.co` origin and a modern
  publishable key; custom domains and legacy anon keys are not supported by this build.
- **Missing history:** confirm the database project, user email, and repository label
  match the original save. History shows at most the latest 20 matching records.

## Verification for this change

- Full local suite passed 42 tests after storage integration, including auth errors,
  rejected destinations/keys, duplicate-save verification, missing acknowledgements,
  hidden-code input, small-terminal menu navigation, and exit during a save.
- Hosted public Auth settings were reachable and email authentication was enabled.
- Hosted anonymous SELECT on keystone_reviews was denied with permission error 42501.
- The user reported successful execution of the migration. An authenticated hosted
  save/read and live two-user isolation check still require verification. Mock tests
  and the anonymous check do not establish those results.
