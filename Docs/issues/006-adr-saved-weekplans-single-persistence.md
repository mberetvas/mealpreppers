# ADR: Saved Weekplans single persistence

## Parent

Architecture consolidation: single **Saved Weekplan** persistence module; retire unscoped `/api/v1/planning/week-templates` (see grilling decisions in agent context, May 2026).

## What to build

Record the agreed architecture decision so future reviews do not re-suggest unscoped week-templates or dual repositories on `meal_week_templates`.

ADR should state (in project vocabulary):

- **Saved Weekplan** is the only product concept for persisted week grids
- One principal-scoped persistence module; **Planning Principal** on all mutations
- `/api/v1/planning/week-templates` removed after client migration
- **`legacy_unowned`** rows handled by audit/migration, not a permanent third API class
- `planningRepository` retains **month plans** and shared recipe-id checks only

Place under `docs/adr/` (create folder if missing). Link from `CONTEXT.md` Planning section if appropriate.

## Acceptance criteria

- [ ] ADR merged with number/title consistent with repo convention
- [ ] Decisions match implemented state after `005-retire-legacy-week-templates-http-api.md` (or note explicit “pending” only if ADR is merged before code—prefer after `005`)
- [ ] No contradiction with `CONTEXT.md` Saved Weekplans / deprecated week-templates notes

## Blocked by

- `005-retire-legacy-week-templates-http-api.md` (ADR documents the final state)

## Type

HITL

## Triage

`needs-triage`
