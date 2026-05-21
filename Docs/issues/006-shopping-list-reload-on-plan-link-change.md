# 006 — Shopping list reload on plan link change

**Type:** AFK  
**Labels:** needs-triage  
**User stories:** 1, 2, 3, 14, 15, 16

## Parent

[PRD: Shopping list — pre-release fixes (gate B)](../prd/shopping-list-pre-release-fixes.md)

## What to build

End-to-end fix for stale **Shopping list** content when the **Shopping list plan link** changes without a full page reload (client-side navigation from Manage plans, nudge links, or any `?plan=` update on `/shopping-list`).

Whenever the plan id query changes, the page must immediately enter the loading state (skeleton), clear prior results, and run the existing load pipeline for the new **Saved Weekplan**. Users must never see **recipe sections** from the previous plan while the new plan loads.

## Acceptance criteria

- [ ] Changing `?plan=` from plan A to plan B without remounting the page triggers a new load for B (not only `onMounted`).
- [ ] While the new load is in progress, the loading skeleton is shown and previous **recipe sections** are hidden.
- [ ] After B loads successfully, the header title and **recipe sections** reflect B.
- [ ] Navigating to an empty or missing plan id still surfaces the existing plan error path after load completes.
- [ ] First visit via deep link (e.g. shopping cart icon from Saved Weekplans) still loads correctly on mount.
- [ ] A test or template-source assertion documents that load is tied to plan id changes (consistent with existing shopping-list / saved-weekplans test patterns).

## Blocked by

None — can start immediately.
