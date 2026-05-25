# Rename `fetchWeekTemplateRowForPlanner` → `fetchSavedWeekplanForPlanner`

**Source:** REV-007 (Low) — branch review 2026-05-25
**Type:** AFK

## What to build

Rename `fetchWeekTemplateRowForPlanner` to `fetchSavedWeekplanForPlanner` in `utils/planningHydration.ts` and update all call sites. This aligns the function name with the **Saved Weekplan** vocabulary established in `CONTEXT.md` and removes the legacy "template" term from the hydration utility.

## Acceptance criteria

- [ ] `fetchWeekTemplateRowForPlanner` is renamed to `fetchSavedWeekplanForPlanner` in `utils/planningHydration.ts`
- [ ] All call sites (`app/pages/weekly-plan.vue`, any tests) updated to use the new name
- [ ] No remaining references to `fetchWeekTemplateRowForPlanner` anywhere in the codebase
- [ ] Existing hydration unit tests pass without modification to their assertions

## Blocked by

None — can start immediately.
