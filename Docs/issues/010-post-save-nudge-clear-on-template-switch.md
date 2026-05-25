# Clear post-save nudge on template switch and hydration

**Source:** REV-002 (Medium) — branch review 2026-05-25
**Type:** AFK

## What to build

Set `shoppingListNudgeId.value = null` at the start of `loadTemplateIntoWeek` and on successful `hydrateTemplateFromRoute` in `app/pages/weekly-plan.vue`. This ensures the "View shopping list" nudge always refers to the currently loaded **Saved Weekplan** and is not carried over when the user switches week grids via the template library or direct route navigation.

## Acceptance criteria

- [ ] `shoppingListNudgeId` is set to `null` at the start of `loadTemplateIntoWeek` (before the load resolves, so stale nudge is never visible alongside a different grid)
- [ ] `shoppingListNudgeId` is set to `null` on successful completion of `hydrateTemplateFromRoute`
- [ ] Unit test: loading a second grid via the template library clears any prior nudge
- [ ] Unit test: route hydration to a different **Saved Weekplan** clears any prior nudge

## Blocked by

None — can start immediately.
