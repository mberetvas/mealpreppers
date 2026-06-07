---
labels:
  - needs-triage
---

# DDD hardening — Phase 1a Recipe Catalog read path and `RecipeRepository`

## Parent

[DDD Desktop Architecture plan](../../.cursor/plans/ddd_desktop_architecture_64de08fc.plan.md) — **Plan Phase 1** (first tracer bullet: catalog reads).

## What to build

Introduce **`recipe_catalog/ports/recipe_repository.rs`** and SQLite **`infrastructure/`** wrapping existing list/get SQL. Extract read use cases (**list**, **get by id**, **options**) into **`application/`**. Extend **`wire_dependencies`** (Phase 1 partial) with **`Arc<dyn RecipeRepository>`** on **`AppState`**.

Refactor **read handlers only** to use traits — **no `open_conn` in handlers** for these routes. Write/image handlers may still use the legacy path until Phase 1b/1c.

Verify **`GET /api/v1/recipes/:id`** remains public (no **Planning Principal** check per CONTEXT).

## Acceptance criteria

- [ ] Integration filters green: `list_recipes`, `get_recipe`, `options_`.
- [ ] Read handlers use **`state.recipes`** (or equivalent) only — no **`open_conn`** in read handler code paths.
- [ ] **`RecipeRepository`** wired from **`wire_dependencies`** and called from **`build_router`** path.
- [ ] Phase 0 platform gate filters still green (`health_`, `migrations_`, `token_`, `stub_`).

## Blocked by

- [0028 — DDD Phase 0 platform foundation](./0028-ddd-phase-0-platform-foundation.md)
