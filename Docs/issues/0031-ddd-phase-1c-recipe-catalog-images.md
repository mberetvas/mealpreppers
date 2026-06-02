---
labels:
  - needs-triage
---

# DDD hardening — Phase 1c Recipe Catalog image store and Phase 1 gate

## Parent

[DDD Desktop Architecture plan](../../.cursor/plans/ddd_desktop_architecture_64de08fc.plan.md) — **Plan Phase 1** (images + Phase 1 completion).

## What to build

Add **`ports/recipe_image_store.rs`**, SQLite infrastructure, and **`application/`** for upload/serve. Wire **`Arc<dyn RecipeImageStore>`** on **`AppState`**. Refactor image handlers — **no `open_conn`** in **`recipe_catalog/handlers.rs`** for any catalog route after this slice.

Add **`planning/ports/recipe_catalog_reader.rs`** trait only (no planning impl — Phase 2a).

Review image validation vs **`app/utils/recipeImageValidation.ts`**; fix gaps if found.

## Acceptance criteria

- [x] Integration filters green: `upload_image`, `serve_recipe_image`, `recipe_images_are_unauthenticated`.
- [x] **Full Phase 1 gate** green (all nine catalog prefixes from plan: read + write + image filters).
- [x] No catalog handler **`open_conn`** anywhere in **`recipe_catalog/handlers.rs`**.
- [ ] Optional smoke: recipes page with **`MEALPREPPER_SIDECAR=1`**.
- [x] **`recipe_catalog_reader`** trait file exists under **`planning/ports/`** (stub; no impl).

## Blocked by

- [0030 — DDD Phase 1b Recipe Catalog write ports](./0030-ddd-phase-1b-recipe-catalog-write-ports.md)
