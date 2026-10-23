# 10 - Pick-up panel

**What to build:** For the selected sprint, a lead sees who has free days and which backlog tickets each person could pick up.
Exact matches in the person's main skill come first by Jira priority, then clearly labeled stretch options costed through the person's proficiency.
Overloaded skills show who in the pod could cover them as a stretch, plus hints about free capacity in other pods.
Nothing is ever written to Jira.

**Blocked by:** 08 - Who is working on what.

**Status:** done (commit a5580e7, live at https://pod-cap.vercel.app)

- [x] People with free capacity are listed with their free days
- [x] Exact matches: backlog plannable tickets in the same pod, in no active or future sprint, estimated only in the person's main skill, fitting their free days
- [x] Stretch options: same, for skills where proficiency is above 0% and below 100%, costed at skill-days / proficiency, and fitting free days
- [x] No stretch option is offered at 0% proficiency
- [x] Ordering: exact before stretch, then Jira priority, then smallest cost; backlog bugs are included
- [x] Stretch options are visibly labeled as stretch
- [x] For each overloaded skill, in-pod people who could cover it as a stretch and how many skill-days they could absorb
- [x] Hints list other pods' free main-skill capacity for skills this pod is short on
