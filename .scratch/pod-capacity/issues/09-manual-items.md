# 09 - Manual items

**What to build:** A lead records work that does not live in Jira (support, interviews, onboarding) and placeholders for planned work not yet ticketed, so it counts against capacity.
A placeholder linked to a Jira key stops counting once that ticket syncs, so nothing is double counted.

**Blocked by:** 08 - Who is working on what.

**Status:** done (commit 05a6b3e, live at https://pod-cap.vercel.app)

- [x] A lead adds a manual item with title, person (optional), skill, days and sprint, as either non-Jira work or a placeholder
- [x] Manual items count toward pod committed skill-days and the person's load
- [x] A placeholder can be linked to a Jira key, and stops counting once that ticket is synced into the sprint
- [x] Leads edit and delete manual items in their own pod only, enforced on the server
- [x] Manual items have no status workflow, comments or sub-items
