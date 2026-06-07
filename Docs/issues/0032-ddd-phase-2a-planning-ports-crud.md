---
labels:
  - needs-triage
---

# DDD hardening — Phase 2a Planning ports, CRUD, and month-plans

## Parent

[DDD Desktop Architecture plan](../../.cursor/plans/ddd_desktop_architecture_64de08fc.plan.md) — **Plan Phase 2** (planning structure before copy-on-match).

## What to build

Refactor **Planning** to **`handlers → application → ports → infrastructure`** for **Saved Weekplans** and **month-plans** CRUD (list, create, get, patch, delete; month-plan routes). Define **`SavedWeekplansRepository`**, **`MonthPlansRepository`**, implement **`RecipeCatalogReader`** using Phase 1 catalog infrastructure. Wire Phase 2a traits on **`AppState`** via **`wire_dependencies`**.

**Out of scope this slice:** **`shoppingListCopiedFromMatch`** and **`ConsolidatedShoppingListCopyPort`** — leave create response as today until Phase 2b.

Planning handlers must not call **`open_conn`** after merge. **No** shopping-list SQL in **`planning/repository.rs`**.

## Acceptance criteria

- [ ] Integration filters green: `saved_weekplan`, `month_plan`, `missingRecipeIds` (existing scenarios; no **`copy_on_match_`** yet).
- [ ] **Mandatory regression:** full Phase 1 integration gate list green.
- [ ] **`RecipeCatalogReader`** implemented; planning validates recipe ids via port.
- [ ] No **`ConsolidatedShoppingListCopyPort`** wiring in this PR.
- [ ] Planning handlers use **`AppState`** traits only.

## Blocked by

- [0031 — DDD Phase 1c Recipe Catalog images](./0031-ddd-phase-1c-recipe-catalog-images.md)
