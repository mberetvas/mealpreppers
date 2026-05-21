# Remove week grid dual path on client

## Parent

Architecture consolidation: single **Saved Weekplan** persistence module; retire unscoped `/api/v1/planning/week-templates` (see grilling decisions in agent context, May 2026).

## What to build

Remove client-side dual routing for week grids so hydration and autosave always follow the **Saved Weekplans** path.

- `fetchWeekTemplateRowForPlanner` (`planningHydration.ts`): drop legacy 404 fallback to `/api/v1/planning/week-templates/:id`
- `usePlanningWeekAutosave`: remove `week-template` PATCH branch when nothing sets that persistence kind

End-to-end: opening a saved plan by id and editing with autosave uses only Saved Weekplans URLs; tests updated accordingly.

## Acceptance criteria

- [ ] Route/query hydration loads week rows only via `/api/v1/saved-weekplans/:id`
- [ ] `usePlanningWeekAutosave` PATCH always uses `/api/v1/saved-weekplans/:id`
- [ ] `planning-hydration` tests no longer assert legacy fallback behavior
- [ ] No remaining client references to `/api/v1/planning/week-templates` for week grid load/patch (grep clean)

## Blocked by

- `003-planner-template-library-uses-saved-weekplans.md`

## Type

AFK

## Triage

`needs-triage`
