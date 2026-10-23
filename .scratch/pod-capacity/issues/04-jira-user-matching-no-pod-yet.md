# 04 - Jira user matching and the "No pod yet" list

**What to build:** Each person in the platform is linked to their Jira account, so tickets attach to the right people.
The admin reviews uncertain matches, sees a "No pod yet" list of Jira users who work on DTP tickets but belong to no pod, and can add, move or remove people.

**Blocked by:** 03 - Jira sync of sprints and plannable tickets.

**Status:** done (commit 95f0b25, live at https://pod-cap.vercel.app)

- [x] Seeded people are matched to Jira accounts by email where Jira exposes it, and by display name otherwise
- [x] Ambiguous matches (for example the two Rahuls) are never auto-confirmed; the admin confirms or corrects them
- [x] A "No pod yet" list shows Jira users who appear as assignee or Dev Owner on DTP tickets but are in no pod
- [x] The admin adds a "No pod yet" person to a pod with a main skill in one action
- [x] The admin can move a person to another pod and remove a person who has left; removed people stop counting anywhere
- [x] Each person belongs to exactly one pod at a time
- [x] Only the admin can change membership, enforced on the server
