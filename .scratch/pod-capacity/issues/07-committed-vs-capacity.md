# 07 - Committed vs capacity per skill

**What to build:** For the selected sprint, a lead sees committed skill-days next to capacity for each skill, with overloaded skills and the size of the gap clearly marked.
Missing estimates show as "not estimated", never as zero, and a list shows tickets with no estimates at all.

**Blocked by:** 06 - Capacity sheet: leave, holidays, focus factor.

**Status:** ready-for-agent

- [ ] Estimates are read from the Jira fields FE Days, BE Days, Data Days and AI Days, discovered by field name at sync time
- [ ] A skill whose field does not exist yet, or is empty on a ticket, shows as "not estimated" and is counted separately
- [ ] Committed skill-days per skill = sum of estimates of the pod's plannable tickets in the sprint
- [ ] Each overloaded skill shows the gap in days
- [ ] A list of the sprint's plannable tickets with no estimates at all, each linking to Jira
- [ ] Bugs in the sprint count like stories
