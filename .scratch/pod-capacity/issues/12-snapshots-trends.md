# 12 - Snapshots and trends

**What to build:** When a sprint starts, the platform freezes each pod's capacity and committed skill-days per skill; when it closes, it records completed skill-days.
A trends page shows capacity, committed and completed per sprint by skill for any pod, so leads can see over-commitment and tune the focus factor.

**Blocked by:** 09 - Manual items.

**Status:** ready-for-agent

- [ ] A sync that sees a sprint go from future to active writes a start snapshot per pod and skill
- [ ] A sync that sees a sprint close writes a close snapshot with completed skill-days (tickets in status category Done)
- [ ] The admin can take or retake either snapshot manually, overwriting the earlier one for that pod, sprint and kind
- [ ] A trends page per pod shows capacity, committed and completed per sprint by skill
- [ ] Every lead can view every pod's trends
- [ ] "Oct Spint 2" (starting 2026-10-26) produces the first start snapshot
