# 11 - Epics

**What to build:** Each pod has an epic list showing every epic with its T-shirt size, the summed skill-days of its child tickets and its Ready for Production Date.
A lead sets T-shirt sizes on their own pod's epics.

**Blocked by:** 07 - Committed vs capacity per skill.

**Status:** ready-for-agent

- [ ] Epics are synced from Jira with their child plannable tickets
- [ ] Each epic shows the sum of its children's skill-days per skill, with "not estimated" handled as in ticket 07
- [ ] Each epic shows its Ready for Production Date from Jira
- [ ] A lead sets S, M, L or XL on their own pod's epics; other pods' epics are read-only, enforced on the server
- [ ] Each pod has an epic list
