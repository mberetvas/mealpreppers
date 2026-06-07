---
labels:
  - needs-triage
---

# DDD hardening — Phase 3a PUT consolidated list and fingerprint parity

## Parent

[DDD Desktop Architecture plan](../../.cursor/plans/ddd_desktop_architecture_64de08fc.plan.md) — **Plan Phase 3a** (write path + TS parity).

## What to build

Layer **`PUT /api/v1/saved-weekplans/:id/consolidated-shopping-list`** through **`application/save_consolidated_shopping_list.rs`** (or equivalent), completing **`ConsolidatedShoppingListRepository`** + **`SavedWeekplanReader`** wiring started in 0034.

**Parity (highest risk):** **`source_fingerprint`** — compare Rust PUT with TS **`saveConsolidatedShoppingList`** (server-side recompute from body vs trusting client field). Align with Vitest goldens; document or fix drift.

**Still frozen:** **`POST .../consolidate-shopping-list`**.

## Acceptance criteria

- [ ] Integration filters green: `put_consolidated`, `put_then_get_consolidated`.
- [ ] **Regression:** `consolidated_shopping_list` GET tests + Phases 0–2 cumulative gates.
- [ ] PUT fingerprint behavior matches TypeScript (or drift documented with intentional exception in PR).
- [ ] **`POST .../consolidate-shopping-list`** not structurally refactored.

## Blocked by

- [0034 — DDD Phase 3a GET consolidated shopping list](./0034-ddd-phase-3a-get-consolidated-shopping-list.md)
