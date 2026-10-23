# 02 - Admin settings: Jira connection and allowlist

**What to build:** The admin opens a settings page and connects the platform to Jira by entering the site, account email and API token.
The token is stored encrypted, never shown again and never sent to the browser.
"Test connection" confirms the token can read the DTP project, and the admin can replace the token to rotate it.
On the same page the admin adds and removes allowlisted email addresses, so a new lead gets access without a code change.
Non-admins cannot see or use the page, and the server refuses their actions.

**Blocked by:** 01 - Sign in with Google, allowlist and seeded pod page.

**Status:** done (commit e6566cf, live at https://pod-cap.vercel.app)

- [x] The admin can save Jira site, email and API token; the token is encrypted at rest with an application key from the environment
- [x] The saved token never appears in any page, response or log; the page only shows that a token is set and when
- [x] "Test connection" reports success or the exact reason for failure (bad credentials, no access to DTP, unreachable site)
- [x] The admin can replace the token, and the old one stops being used
- [x] The admin can add and remove allowlisted addresses; addresses are normalised to lowercase
- [x] The admin cannot remove their own address or the last admin
- [x] A non-admin is refused by the server for every settings action, not just hidden in the UI
- [x] Service tests cover encryption round-trip, permission refusals and allowlist edits; the Jira check runs against a fake Jira client
- [x] Hosting: the encryption key env var is documented and set on Vercel production
