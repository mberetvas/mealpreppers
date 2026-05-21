# Planner template library uses Saved Weekplans

## Parent

Architecture consolidation: single **Saved Weekplan** persistence module; retire unscoped `/api/v1/planning/week-templates` (see grilling decisions in agent context, May 2026).

## What to build

On the weekly planner (`weekly-plan.vue`), the in-planner template library becomes **my Saved Weekplans** for the current **Planning Principal**—not a global unscoped catalog.

End-to-end: list, load into the week grid, and delete templates via `/api/v1/saved-weekplans` only. After load, `persistenceKind` (or equivalent) is `saved-weekplan` so autosave PATCH targets the preferred API.

## Acceptance criteria

- [ ] Template list fetch uses `GET /api/v1/saved-weekplans`
- [ ] Load template into week uses `GET /api/v1/saved-weekplans/:id` and sets persistence to Saved Weekplan
- [ ] Delete template uses `DELETE /api/v1/saved-weekplans/:id`
- [ ] Planner no longer calls `GET`/`DELETE` `/api/v1/planning/week-templates` for template library actions
- [ ] Manual check: anonymous and signed-in sessions only see their own Saved Weekplans in the picker

## Blocked by

- `002-unify-saved-weekplans-persistence-module.md`

## Type

AFK

## Triage

`needs-triage`
