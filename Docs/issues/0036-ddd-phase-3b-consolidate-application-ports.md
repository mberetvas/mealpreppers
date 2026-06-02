---
labels:
  - needs-triage
---

# DDD hardening — Phase 3b consolidate POST — application layer and port boundaries

## Parent

[DDD Desktop Architecture plan](../../.cursor/plans/ddd_desktop_architecture_64de08fc.plan.md) — **Plan Phase 3b** (structure first; algorithms frozen).

## What to build

Refactor **`POST /api/v1/saved-weekplans/:id/consolidate-shopping-list`**: move orchestration from **`consolidation.rs`** to **`application/consolidate_shopping_list.rs`**. Keep **`exact_merge.rs`** and **`openrouter.rs`** logic unchanged (move calls, not rewrite).

Replace direct **`planning::repository`** and **`recipe_catalog::repository`** imports with slice **ports** (readers defined by shopping_list consumer, implemented by owning slices). Wire any new read ports on **`AppState`**.

**Out of scope this slice:** behavioral changes to AI polish flags or OpenRouter logging policy (0037).

## Acceptance criteria

- [ ] All **`consolidate_shopping_list_*`** integration tests green (same behavior as before refactor).
- [ ] Cumulative gates: 0035 exit + Phases 0–2.
- [ ] No **`planning::repository`** or **`recipe_catalog::repository`** imports in shopping_list **application** code.
- [ ] **`exact_merge`** / **`openrouter`** algorithms diff shows orchestration-only moves.

## Blocked by

- [0035 — DDD Phase 3a PUT consolidated fingerprint parity](./0035-ddd-phase-3a-put-consolidated-fingerprint-parity.md)
