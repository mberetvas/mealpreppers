---
labels:
  - needs-triage
---

# DDD hardening — Phase 1b Recipe Catalog write path (`RecipeRepository`)

## Parent

[DDD Desktop Architecture plan](../../.cursor/plans/ddd_desktop_architecture_64de08fc.plan.md) — **Plan Phase 1** (catalog mutations).

## What to build

Extend **`RecipeRepository`** and **`application/`** with create, update, and bulk-delete use cases. Refactor **write handlers** (`POST`, `PATCH`, bulk delete) to use **`AppState`** traits only — **no `open_conn`** in write handlers.

Reuse Phase 1a infrastructure; extend **`wire_dependencies`** only if new trait methods require it.

## Acceptance criteria

- [ ] Integration filters green: `create_recipe`, `update_recipe`, `bulk_delete`.
- [ ] **Regression:** Phase 1a filters green (`list_recipes`, `get_recipe`, `options_`).
- [ ] Write handlers use repository trait only — no dual DI / handler **`open_conn`**.
- [ ] Invalid inputs and **`RepoError`** mapping unchanged vs pre-refactor behavior.

## Blocked by

- [0029 — DDD Phase 1a Recipe Catalog read ports](./0029-ddd-phase-1a-recipe-catalog-read-ports.md)
