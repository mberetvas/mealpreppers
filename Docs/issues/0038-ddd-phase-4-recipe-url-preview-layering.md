---
labels:
  - needs-triage
---

# DDD hardening — Phase 4 Recipe URL preview layering

## Parent

[DDD Desktop Architecture plan](../../.cursor/plans/ddd_desktop_architecture_64de08fc.plan.md) — **Plan Phase 4** (Recipe Ingestion preview; behavior already shipped).

## What to build

Apply DDD layering to **recipe_ingestion** without rewriting fetch/scrape algorithms: **`application/preview_recipe_from_url.rs`**, ports for fetch + scraper, infrastructure adapters from existing code, **`wire_dependencies` Phase 4** adding preview ports on **`AppState`**. Handlers become thin; integration tests **`recipe_preview_*`** remain the behavioral contract.

## Acceptance criteria

- [ ] Phase 4 filter green: `recipe_preview` (all `recipe_preview_*` integration tests).
- [ ] Cumulative gates green: Phases 0–3b (0037 + prior slices).
- [ ] No algorithm rewrite in preview path (orchestration move only).
- [ ] Fetch timeouts and **403** auth wall behavior unchanged.

## Blocked by

- [0037 — DDD Phase 3b AI polish parity](./0037-ddd-phase-3b-consolidate-ai-polish-parity.md)
