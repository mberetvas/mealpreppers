# Desktop domain layers (shadow_server)

Stub for the DDD hardening program (`Docs/issues/0028`–`0039`). Completed in issue **0039**.

## Phase legend

| Label | Meaning |
|-------|---------|
| **Plan Phase N** | DDD hardening slice in `Docs/issues/0028`–`0039` and `wire::WirePhase` |
| **Route-milestone Phase N** | Legacy comment groups in `routes.rs` (platform → catalog → planning port) |
| **WirePhase** | Composition-root phase passed to `wire_dependencies` in `wire.rs` |

**Plan Phase N ≠ route-milestone Phase N.** Do not cross-reference the two numbering schemes.

## Composition root

| Path | Role |
|------|------|
| `src-tauri/src/shadow_server/wire.rs` | `wire_dependencies` — trait wiring onto `AppState` |
| `src-tauri/src/shadow_server/routes.rs` | `build_router` — calls `wire_dependencies` before route registration |
| `src-tauri/src/shadow_server/platform/` | Cross-slice platform types (`RepoError`) |

## Dev matrix (API runtime)

| Mode | API process | Notes |
|------|-------------|-------|
| Dev loop A (`desktop:dev`) | Nuxt Nitro (optional) | Fast UI HMR; may hit TypeScript `server/` APIs |
| Dev loop B (`MEALPREPPER_SIDECAR=1`) | **Rust Axum only** | Production-like token + SQLite paths |
| Packaged app | **Rust Axum only** | In-process `shadow_server`; no Node/Nitro child |

Axum persistence is **Rust + SQLite** (`rusqlite` / sqlx-style repositories), not Drizzle.

## Per-slice route tables (placeholders)

Filled in as each Plan Phase lands. Route shapes match `routes.rs`.

### Recipe Catalog

| Route | Use case (planned) | Port (planned) |
|-------|-------------------|----------------|
| `GET /api/v1/recipes` | `application/list_recipes` | `RecipeRepository` (Phase 1a) |
| `GET /api/v1/recipes/:id` | `application/get_recipe` | `RecipeRepository` (Phase 1a) |
| `GET /api/v1/recipes/options` | `application/recipe_options` | `RecipeRepository` (Phase 1a) |
| `POST /api/v1/recipes` | `application/create_recipe` | `RecipeRepository` (Phase 1b) |
| `PUT /api/v1/recipes/:id` | `application/update_recipe` | `RecipeRepository` (Phase 1b) |
| `POST /api/v1/recipes/bulk-delete` | `application/bulk_delete_recipes` | `RecipeRepository` (Phase 1b) |
| `POST /api/v1/recipes/upload-image` | — | image port (TBD) |

### Planning

| Route | Use case (planned) | Port (planned) |
|-------|-------------------|----------------|
| `GET/POST /api/v1/saved-weekplans` | — | `SavedWeekplansRepository` |
| `GET/PATCH/DELETE /api/v1/saved-weekplans/:id` | — | `SavedWeekplansRepository` |
| `GET/POST /api/v1/planning/month-plans` | — | `MonthPlansRepository` |
| `GET/PATCH/DELETE /api/v1/planning/month-plans/:id` | — | `MonthPlansRepository` |

### Shopping List

| Route | Use case (planned) | Port (planned) |
|-------|-------------------|----------------|
| `POST .../consolidate-shopping-list` | — | consolidation ports (TBD) |
| `GET/PUT .../consolidated-shopping-list` | — | `ConsolidatedShoppingListRepository` |

### Recipe Ingestion

| Route | Use case (planned) | Port (planned) |
|-------|-------------------|----------------|
| `POST /api/v1/recipes/preview` | — | fetch + scraper ports (TBD) |

## Platform (Phase 0 — done)

- Unified `platform::RepoError` for all slices
- `wire_dependencies` invoked from `build_router` (`WirePhase::Phase1b` for catalog CRUD)

## Recipe Catalog reads (Phase 1a — done)

- `ports/recipe_repository.rs` + `infrastructure/sqlite_recipe_repository.rs`
- Read handlers use `state.recipes` only (no `open_conn` on list/get/options paths)

## Recipe Catalog writes (Phase 1b — done)

- `RecipeRepository` extended with create, update, bulk-delete
- Write handlers use `state.recipes` only (no `open_conn` on POST/PUT/bulk-delete paths)
