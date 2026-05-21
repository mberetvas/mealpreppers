# Saved Weekplans single persistence

**Status:** accepted (May 2026)

After client migration off the deprecated unscoped week-templates HTTP surface, Planning persists weekly meal grids through one principal-scoped module. **Saved Weekplan** is the only product concept for persisted week grids; there is no parallel “week template” API class for app features.

## Decisions

- **Saved Weekplan** is the sole product concept for persisted week grids (`WeekPlanV1` plus title and metadata), scoped to the **Planning Principal** (signed-in user or anonymous session).
- Week-grid reads and mutations go through one principal-scoped persistence module (`savedWeekplansRepository`), backed by `meal_week_templates` with **Planning Principal** checks on every mutation via `interpretSavedWeekplanAccess`.
- Public HTTP for week grids is only `/api/v1/saved-weekplans/*`. Unscoped `/api/v1/planning/week-templates` was **removed** after client migration (issue 005, May 2026).
- Rows classified as **`legacy_unowned`** (both `owner_user_id` and `anon_session_id` null) are migration debt: audit, backfill, or purge via scripts—not a permanent third API or repository path. The Saved Weekplans API returns not-found for these rows.
- `planningRepository` retains **month plans** (`meal_month_plans`) and shared **recipe-id** validation helpers (`collectRecipeIdsFromWeekPlan`, `assertRecipeIdsExist`, etc.) only; it does not own week-grid CRUD.

## Consequences

- Do not reintroduce unscoped week-templates routes or duplicate week-grid repositories on `meal_week_templates`.
- In-planner template library, hydration, and autosave must call Saved Weekplans endpoints only.
- Follow-up data work for `legacy_unowned` rows lives under audit/migration (see `Docs/audits/001-legacy-unowned-week-grid-rows.md`), not new HTTP surfaces.
