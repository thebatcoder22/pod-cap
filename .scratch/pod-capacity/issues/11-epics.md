# 11 - Epics

**What to build:** Each pod has an epic list showing every epic with its T-shirt size, the summed skill-days of its child tickets and its Ready for Production Date.
A lead sets T-shirt sizes on their own pod's epics.

**Blocked by:** 07 - Committed vs capacity per skill.

**Status:** done (commit 5b84a7e, live at https://pod-cap.vercel.app)

- [x] Epics are synced from Jira with their child plannable tickets
- [x] Each epic shows the sum of its children's skill-days per skill, with "not estimated" handled as in ticket 07
- [x] Each epic shows its Ready for Production Date from Jira
- [x] A lead sets S, M, L or XL on their own pod's epics; other pods' epics are read-only, enforced on the server
- [x] Each pod has an epic list
