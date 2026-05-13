# 005 — Shopping List: post-save nudge banner in the Weekly Atelier

## What to build

Show a dismissible banner in the Weekly Atelier immediately after a draft week is first saved as a Saved Weekplan.

In `app/pages/weekly-plan.vue`, after `persistDraftAsSavedWeekplan()` succeeds, set a reactive ref (`shoppingListNudgeId`) to the newly created plan ID. Render a banner near the save status area while this ref is non-null. The banner contains:
- Static copy: "Plan saved!"
- A "View shopping list" link to `/shopping-list?plan=<id>`.
- A dismiss (×) button that sets the ref back to null.

The banner must use `role="status"` and `aria-live="polite"` semantics. It must NOT re-appear on subsequent autosave PATCHes — only the first-save POST sets the ref.

## Acceptance criteria

- [ ] Saving a new draft weekplan (first-save POST) causes the nudge banner to appear.
- [ ] The banner copy reads "Plan saved!" and includes a "View shopping list" link.
- [ ] The link navigates to `/shopping-list?plan=<id>` for the correct plan.
- [ ] Clicking the dismiss (×) button hides the banner.
- [ ] Subsequent autosave PATCHes to the same plan do NOT re-show the banner.
- [ ] Opening a previously saved plan from `/saved-weekplans` (PATCH flow) does NOT show the banner.
- [ ] The banner uses `role="status"` and `aria-live="polite"` so screen readers announce it non-disruptively.
- [ ] The banner does not block or obscure the planner grid or save status pill.
- [ ] Navigating away from the page resets the nudge (reactive state cleared on unmount).

## Blocked by

- #002 — Shopping List: page happy path
