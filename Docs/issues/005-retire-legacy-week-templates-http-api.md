# Retire legacy week-templates HTTP API

## Parent

Architecture consolidation: single **Saved Weekplan** persistence module; retire unscoped `/api/v1/planning/week-templates` (see grilling decisions in agent context, May 2026).

## What to build

Delete the deprecated `/api/v1/planning/week-templates` surface once no callers remain. Remove handlers under `server/api/v1/planning/week-templates/`, update or remove `DEPRECATED.md`, and delete tests that only guard legacy arity or unscoped delegation (`week-templates-legacy-compat`, week-templates handler-seam tests).

Public week-grid HTTP is only `/api/v1/saved-weekplans/*`, backed by the unified persistence module.

## Acceptance criteria

- [ ] No `server/api/v1/planning/week-templates/*.ts` route handlers remain
- [ ] `DEPRECATED.md` removed or replaced with a short note in git history / CONTEXT if needed
- [ ] Legacy-specific unit tests removed; Saved Weekplans handler-seam tests still pass
- [ ] Repo grep shows no imports of removed `*WeekTemplate*` repository functions

## Blocked by

- `004-remove-week-grid-dual-path-on-client.md`

## Type

AFK

## Triage

`needs-triage`
