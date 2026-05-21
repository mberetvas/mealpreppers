# Unify Saved Weekplans persistence module

## Parent

Architecture consolidation: single **Saved Weekplan** persistence module; retire unscoped `/api/v1/planning/week-templates` (see grilling decisions in agent context, May 2026).

## What to build

Merge duplicate week-grid persistence into one deep server module for **Saved Weekplans** on `meal_week_templates`. All principal-scoped list/get/create/update/delete and anonymous merge/purge helpers live together with shared row mapping and storage-error handling.

Remove week-template CRUD from `planningRepository` (keep **month plans**, `assertRecipeIdsExist`, and shared row types there). **Saved Weekplans** HTTP handlers (`/api/v1/saved-weekplans/*`) continue to work unchanged from a caller perspective, backed only by the unified module.

Verify with existing and updated unit tests at the repository interface (principal scoping, owner columns on create, `legacy_unowned` not returned to principals).

## Acceptance criteria

- [ ] Single module owns all principal-scoped `meal_week_templates` access used by Saved Weekplans handlers
- [ ] `planningRepository` no longer exports `listWeekTemplates`, `getWeekTemplateById`, `createWeekTemplate`, `updateWeekTemplate`, or `deleteWeekTemplate`
- [ ] `GET`/`POST`/`GET|PATCH|DELETE` `/api/v1/saved-weekplans` behavior unchanged for owned rows (tests green)
- [ ] Repository tests cover list/get/mutate scoping via **Planning Principal** and `interpretSavedWeekplanAccess`

## Blocked by

- `001-audit-legacy-unowned-week-grid-rows.md` (migration decision must be known; implementation can proceed once audit says zero rows or backfill is done)

## Type

AFK

## Triage

`needs-triage`
