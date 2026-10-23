# 05 - Proficiency editing

**What to build:** The pod page shows each person's proficiency in FE, BE, Data and AI.
The main skill is fixed at 100% and other skills default to 0%.
A lead edits proficiency for their own pod's people, and other leads see it read-only.

**Blocked by:** 01 - Sign in with Google, allowlist and seeded pod page.

**Status:** done (commit 730c7ea, live at https://pod-cap.vercel.app)

- [x] Every person shows a percentage for each of the four skills; main skill is 100% and cannot be changed
- [x] Non-main skills default to 0%
- [x] A lead can set a percentage (0-100) for their own people in each non-main skill
- [x] Editing another pod's proficiency is refused by the server
- [x] Proficiency is visible to every lead
