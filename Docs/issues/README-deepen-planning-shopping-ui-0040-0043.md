# Deepen Planning & Shopping UI — issues 0040–0043

Tracer-bullet issues derived from [Deepen Planning Shopping UI plan](../../.cursor/plans/deepen_planning_shopping_ui_000a5b3e.plan.md).

| # | Title | Type | Blocked by |
|---|-------|------|------------|
| [0040](./0040-deepen-phase-1-saved-weekplan-reader-seam.md) | Unify Saved Weekplan reads through `SavedWeekplanReader` | AFK | — |
| [0041](./0041-deepen-phase-2-consolidation-application.md) | Injectable shopping list consolidation application | AFK | 0040 |
| [0042](./0042-deepen-phase-3-shared-shopping-list-dtos.md) | Shared shopping-list type contracts | AFK | 0041 |
| [0043](./0043-deepen-phase-4-weekly-plan-composables.md) | Decompose `weekly-plan` page into planner composables | AFK | 0042 |

**Dependency order:** 0040 → 0041 → 0042 → 0043 (0043 may start with inline types if 0042 is not merged yet, but should land after 0042).

**Verification (all phases):** `just test`, `nuxt typecheck`, plus manual smoke checklist in the parent plan.

**Out of scope (parent plan):** planning ↔ shopping-list shared kernel, Nitro ↔ Rust parity fixtures, client N+1 recipe fetches, Rust `shadow_server` implementation.
