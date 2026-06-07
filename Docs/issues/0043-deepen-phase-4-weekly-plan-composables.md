---
labels:
  - ready-for-agent
---

# Deepen — Phase 4: Decompose weekly-plan page into planner composables

## Parent

[Deepen Planning Shopping UI plan](../../.cursor/plans/deepen_planning_shopping_ui_000a5b3e.plan.md) — **Phase 4 / PR-D** (weekly-plan.vue decomposition).

## What to build

Decompose the weekly planner page (~700 lines) into focused composables while preserving the existing draft → saved → autosave state machine (`WeekPlannerPersistenceKind`).

Extract:

| Composable | Responsibility |
|------------|----------------|
| `usePlannerWeekDraft` | sessionStorage snapshot, debounced flush, `beforeunload`, `onBeforeRouteLeave` |
| `useSavedWeekplanHydration` | `?template=` hydration, `loadTemplateIntoWeek`, shopping-list flags sync |
| `useWeeklyPlannerFirstSave` | `persistDraftAsSavedWeekplan`, first-save busy state, nudge banner |
| `usePlannerTemplatesTab` | template list, delete, per-row busy id |
| `usePlannerMonthTab` | month lazy load, snapshot/open week |

The page retains: tab state, recipe picker/remove overlays, `weekPlan` ref wiring, header/save pill computed props.

Use `SavedWeekplanWithListFlags` from shared shopping-list types (0042).

Extend existing weekly-plan unit tests (template library, nudge clear on switch). Add `useWeeklyPlannerFirstSave` unit test (mock fetch; draft → saved transition).

**Out of scope:** new planner features, shopping-list consolidation changes, Rust changes.

## Acceptance criteria

- [ ] Five composables extracted with responsibilities as above; page orchestrates them without duplicating fetch/persistence logic.
- [ ] `weekly-plan` page under ~300 lines.
- [ ] Draft recovery, `?template=` hydration, first-save POST, autosave PATCH, and tab switching behave as before.
- [ ] State machine preserved: Draft → SavedWeekplan (first save or load template) → SavedWeekplan (autosave); Draft on delete active or open month week.
- [ ] Unit tests extended for template library and nudge behavior; new first-save composable test added.
- [ ] `nuxt typecheck` and `just test` pass.

## Blocked by

- [0042 — Phase 3 shared shopping-list DTOs](./0042-deepen-phase-3-shared-shopping-list-dtos.md) (inline types acceptable temporarily during development, but merge after 0042).
