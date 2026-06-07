---
labels:
  - ready-for-agent
---

# Deepen — Phase 3: Shared shopping-list type contracts

## Parent

[Deepen Planning Shopping UI plan](../../.cursor/plans/deepen_planning_shopping_ui_000a5b3e.plan.md) — **Phase 3 / PR-C** (shared shopping-list DTOs).

## What to build

Create a shared `types/shopping-list.ts` module as the single contract surface for shopping-list display and API types. Move or re-export from server modules:

- Merge/display types (`MergedLine`, `RecipeProvenance`)
- Consolidation result types (`PolishStatus`, `ConsolidationResult`)
- Polish review types (`PolishHint`, `PolishResponseChange`)
- Persisted list record types (`SavedConsolidatedShoppingListRecord`, `SavedShoppingListLine`)
- Read-model flags (`ShoppingListFlags`)
- `AisleCategory` (re-export from shared aisle sort)

Add client-facing aliases: `ConsolidationResponse`, `SavedWeekplanWithListFlags` (`hasSavedShoppingList`, `shoppingListDeprecated`).

Update server modules to import types from the shared module; keep Zod validation in repository or a dedicated schema module.

Update all client imports (consolidated shopping list composable, shopping-list page, polish/aisle/preview components, weekly-plan inline fetch types) to use `types/shopping-list` — **zero** `app/**` imports from `server/services/**`.

Remove client-side `inferAisleCategoryFromName` from display sorting. Per ADR 0004, legacy saved lists without `aisleCategory` display flat until re-consolidation.

**Out of scope:** weekly-plan page decomposition (0043), new consolidation behavior, Rust changes.

## Acceptance criteria

- [ ] `types/shopping-list.ts` exists with the consolidated type surface; server and app both import from it.
- [ ] No `app/**` imports from `server/services/**` for shopping-list types or aisle inference.
- [ ] Client `sortLinesForDisplay` no longer infers aisle category from ingredient names.
- [ ] `nuxt typecheck` passes.
- [ ] Existing composable and shopping-list unit tests pass (updated imports only; no behavior change).
- [ ] `just test` passes.

## Blocked by

- [0041 — Phase 2 consolidation application](./0041-deepen-phase-2-consolidation-application.md)
