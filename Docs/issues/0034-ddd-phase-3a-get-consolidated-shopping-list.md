---
labels:
  - needs-triage
---

# DDD hardening — Phase 3a GET consolidated shopping list

## Parent

[DDD Desktop Architecture plan](../../.cursor/plans/ddd_desktop_architecture_64de08fc.plan.md) — **Plan Phase 3a** (read path first).

## What to build

Layer **`GET /api/v1/saved-weekplans/:id/consolidated-shopping-list`** through **`application/get_consolidated_shopping_list.rs`** (or equivalent), **`ports/consolidated_shopping_list_repository.rs`**, and **`ports/saved_weekplan_reader.rs`** (planning ownership read). Wire Phase 3a-read traits on **`AppState`**.

**Frozen:** **`PUT`** consolidated and **`POST .../consolidate-shopping-list`** — no refactor of **`consolidation.rs`**; consolidation tests stay green.

## Acceptance criteria

- [ ] GET integration tests green: `get_consolidated_shopping_list`.
- [ ] Principal scoping test green: `consolidated_shopping_list_respects` (GET path; may use existing PUT setup in test harness).
- [ ] **Regression (legacy PUT still wired):** `put_consolidated`, `put_then_get_consolidated` — must stay green without PUT application refactor.
- [ ] **Planning Principal** scoping unchanged.
- [ ] Cumulative gates: Phase 0 filters + Phase 1 full gate + Phase 2a/2b filters.
- [ ] PUT handler and **`consolidation.rs`** not moved to `application/` yet (0035 owns PUT layering).

## Blocked by

- [0033 — DDD Phase 2b copy-on-match](./0033-ddd-phase-2b-planning-copy-on-match.md)
