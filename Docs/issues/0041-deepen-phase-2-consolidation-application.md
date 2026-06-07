---
labels:
  - ready-for-agent
---

# Deepen — Phase 2: Injectable shopping list consolidation application

## Parent

[Deepen Planning Shopping UI plan](../../.cursor/plans/deepen_planning_shopping_ui_000a5b3e.plan.md) — **Phase 2 / PR-B** (consolidation application seam).

## What to build

Extract shopping list consolidation orchestration into an injectable application function (`executeConsolidateShoppingList`) that accepts explicit dependencies: database handle, `SavedWeekplanReader`, and a `listRecipes` function — no internal `getDb()` or direct repository imports.

Move the orchestration body out of the existing consolidation service module; keep a thin re-export during migration if needed, then remove duplication.

Expand the planning composition root to expose consolidation dependencies (`db` + reader + `listRecipes`) alongside existing saved-weekplan deps.

Extract polish-port construction from the consolidate-shopping-list HTTP handler into a factory (uses existing polish chain factory). Handler flow: parse id → build polish port → call application function with deps → return result.

Refactor consolidation unit tests to inject a fake reader and fake `listRecipes` instead of mocking repository modules. Keep handler seam tests. Add a golden-path test with real SQLite and a stub `ShoppingListPolishPort`.

Product behavior unchanged: ADR 0004 auto-consolidation, copy-on-match, and session draft rules stay intact.

**Out of scope:** shared `types/shopping-list.ts` migration (0042), weekly-plan UI, Rust `shadow_server` parity (enabled later by this seam, not implemented here).

## Acceptance criteria

- [ ] Consolidation application module contains no `getDb()` and no direct calls to `getSavedWeekplanById` / `listRecipes` repositories — only injected deps.
- [ ] Consolidate-shopping-list handler uses composition-root deps and extracted polish-port factory; no inline OpenRouter/LangChain wiring in the handler.
- [ ] Consolidation unit tests inject fake reader + fake `listRecipes` (no `vi.mock` on repository/getDb modules).
- [ ] Handler seam tests still pass; SQLite + stub polish port golden path added.
- [ ] Consolidation API behavior unchanged (existing integration/unit scenarios green).
- [ ] `just test` passes.

## Blocked by

- [0040 — Phase 1 Saved Weekplan reader seam](./0040-deepen-phase-1-saved-weekplan-reader-seam.md)
