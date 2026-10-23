# 09 - Manual items

**What to build:** A lead records work that does not live in Jira (support, interviews, onboarding) and placeholders for planned work not yet ticketed, so it counts against capacity.
A placeholder linked to a Jira key stops counting once that ticket syncs, so nothing is double counted.

**Blocked by:** 08 - Who is working on what.

**Status:** ready-for-agent

- [ ] A lead adds a manual item with title, person (optional), skill, days and sprint, as either non-Jira work or a placeholder
- [ ] Manual items count toward pod committed skill-days and the person's load
- [ ] A placeholder can be linked to a Jira key, and stops counting once that ticket is synced into the sprint
- [ ] Leads edit and delete manual items in their own pod only, enforced on the server
- [ ] Manual items have no status workflow, comments or sub-items
