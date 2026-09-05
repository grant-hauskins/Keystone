# Save and revisit Keystone records

This guide begins with your Supabase connection and Keystone account already set up.

## Sign in if needed

Scroll to **Password sign-in**, press Enter, and enter your Keystone account email. Then enter your Keystone account password in the masked field. Successful login displays “Signed in.” Do not use an AI key or mailbox password here.

If your existing installation uses email-code login, use **Email sign-in** and **Enter sign-in code** instead. This guide does not cover configuring either login method.

Sign-in lasts for the current session. When it expires, sign in again. **Sign out** ends local access and clears loaded history.

## Save a record

1. Choose **Repository** and the comparison you intend to examine.
2. Choose **Inspect changes**. Optionally run an AI review afterward.
3. Set **Repository label** to a stable name such as `owner/project`. Use the same label for this repository in every session and connected agent.
4. Choose **Save to database**.
5. Wait for **RECORD SAVED SUCCESSFULLY** and the Supabase record ID.

The record contains the report and repository label. A review report includes findings and proposed task text; an inspection-only report does not include an AI evaluation. Saving confirms afterward without an extra approval step.

If the save is interrupted, retry the same report in the same session without inspecting again. Keystone reuses the record ID and checks an existing matching record. After restarting, check history before repeating an uncertain save.

## Read history

Choose **Load history**. Keystone opens **History**, showing the latest 20 records for your signed-in user and exact repository label. Use PgUp/PgDn or j/k to scroll through summaries, findings, and proposals.

Check the record ID, date, and reviewed commits to identify the right record. Loading history does not replace your current inspection. An old proposal is historical information, not the current task.

If the list is empty, check your account and Repository label. Records saved under another label will not appear in this list. Shared team history is not part of the current version.

## Export a local copy

Use **Save report** to save the current inspection or review as a new JSON file. Choose an existing folder and a new filename. Keystone refuses to overwrite an existing file and shows the saved path after success.

JSON export and database saving are separate actions. Saving to one destination does not automatically copy the record to the other.

## Keep the task current

Neither save action applies a task proposal. Give the findings and proposed text to your agent, ask it to verify them, and have it update `.context/active-task.md` as part of authorized work. Commit that work before the next inspection.
