//! Axum routes for the Desktop Local API shadow server.
//!
//! Phase 1 (platform milestone) exposes:
//! - `GET /health` — unauthenticated liveness probe (same contract as Nitro's `/health`).
//! - `GET /api/v1/stub` — authenticated test-only route that logs **Trace ID** and
//!   **Planning Principal** using `domain.action` **Log Event Names** and returns them in the
//!   response body for integration-test assertions.
//!
//! Phase 2 (Recipe Catalog) adds:
//! - `GET  /api/v1/recipes`              — list recipes
//! - `POST /api/v1/recipes`              — create recipe
//! - `GET  /api/v1/recipes/options`      — categories + tags (defaults merged with stored)
//! - `POST /api/v1/recipes/bulk-delete`  — delete multiple recipes
//! - `POST /api/v1/recipes/upload-image` — upload a recipe image
//! - `GET  /api/v1/recipes/:id`          — get single recipe
//! - `PUT  /api/v1/recipes/:id`          — update recipe
//! - `GET  /recipe-images/:filename`     — serve stored image (unauthenticated)
//!
//! Phase 3 (Planning) adds:
//! - `GET    /api/v1/saved-weekplans`          — list saved weekplans (principal-scoped)
//! - `POST   /api/v1/saved-weekplans`          — create saved weekplan
//! - `GET    /api/v1/saved-weekplans/:id`      — get saved weekplan
//! - `PATCH  /api/v1/saved-weekplans/:id`      — patch saved weekplan
//! - `DELETE /api/v1/saved-weekplans/:id`      — delete saved weekplan
//! - `GET    /api/v1/planning/month-plans`     — list month plans
//! - `POST   /api/v1/planning/month-plans`     — create month plan
//! - `GET    /api/v1/planning/month-plans/:id` — get month plan
//! - `PATCH  /api/v1/planning/month-plans/:id` — patch month plan
//! - `DELETE /api/v1/planning/month-plans/:id` — delete month plan
//!
//! Cutover feature gates (deferred — Desktop backend phase 2):
//! - `POST /api/v1/recipes/preview`                                    — recipe URL import (501)
//! - `POST /api/v1/saved-weekplans/:id/consolidate-shopping-list`      — consolidation (501)
//! - `GET  /api/v1/saved-weekplans/:id/consolidated-shopping-list`     — saved list read (501)
//! - `PUT  /api/v1/saved-weekplans/:id/consolidated-shopping-list`     — saved list write (501)

use std::path::PathBuf;

use axum::{
    extract::Extension,
    middleware,
    response::Json,
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};

use crate::shadow_server::{
    error::AppError,
    middleware::{request_context_layer, token_gate},
    planning::handlers::{
        create_month_plan_handler, create_saved_weekplan_handler, delete_month_plan_handler,
        delete_saved_weekplan_handler, get_month_plan_handler, get_saved_weekplan_handler,
        list_month_plans_handler, list_saved_weekplans_handler, patch_month_plan_handler,
        patch_saved_weekplan_handler,
    },
    recipe_catalog::{
        handlers::{
            bulk_delete_handler, create_recipe_handler, get_recipe_handler,
            list_recipes_handler, options_handler, update_recipe_handler,
        },
        image::{serve_image_handler, upload_image_handler},
    },
    recipe_ingestion::handlers::preview_recipe_handler,
    request_context::RequestContext,
    shopping_list::handlers::{
        consolidate_shopping_list_handler, get_consolidated_shopping_list_handler,
        put_consolidated_shopping_list_handler,
    },
};

/// Shared application state threaded through the Axum router.
#[derive(Clone)]
pub struct AppState {
    /// App data directory — used to resolve the `local-user-id` **Planning Principal** file
    /// and to locate the SQLite database and recipe-image storage.
    pub data_dir: PathBuf,
    /// Optional desktop token value; when `Some`, `/api/**` routes require `X-Desktop-Token`.
    pub token: Option<String>,
    /// Loopback port the server is listening on — used in image upload response URLs.
    pub port: u16,
}

impl AppState {
    /// Returns the path to the install-scoped SQLite database.
    ///
    /// Mirrors `resolve_db_path` in `mod.rs`:
    /// - `$DATABASE_PATH` env var (trimmed) when set and non-empty
    /// - otherwise `{data_dir}/mealprepper.db`
    pub fn db_path(&self) -> PathBuf {
        if let Ok(path) = std::env::var("DATABASE_PATH") {
            let trimmed = path.trim().to_string();
            if !trimmed.is_empty() {
                return PathBuf::from(trimmed);
            }
        }
        self.data_dir.join("mealprepper.db")
    }

    /// Returns the directory where recipe images are stored.
    pub fn recipe_images_dir(&self) -> PathBuf {
        self.data_dir.join("recipe-images")
    }
}

/// Assembles the full Axum router with all middleware layers.
pub fn build_router(state: AppState) -> Router {
    // `/api/**` routes — token-gated via route_layer so /health and /recipe-images are unaffected
    let api_routes = Router::new()
        .route("/v1/stub", get(stub_handler))
        // Recipe Catalog — static paths before parameterised to satisfy matchit ordering
        .route("/v1/recipes/options", get(options_handler))
        .route("/v1/recipes/bulk-delete", post(bulk_delete_handler))
        .route("/v1/recipes/upload-image", post(upload_image_handler))
        .route(
            "/v1/recipes",
            get(list_recipes_handler).post(create_recipe_handler),
        )
        .route(
            "/v1/recipes/:id",
            get(get_recipe_handler).put(update_recipe_handler),
        )
        // Planning — Saved Weekplans (principal-scoped)
        .route(
            "/v1/saved-weekplans",
            get(list_saved_weekplans_handler).post(create_saved_weekplan_handler),
        )
        .route(
            "/v1/saved-weekplans/:id",
            get(get_saved_weekplan_handler)
                .patch(patch_saved_weekplan_handler)
                .delete(delete_saved_weekplan_handler),
        )
        // Planning — Month Plans (install-global)
        .route(
            "/v1/planning/month-plans",
            get(list_month_plans_handler).post(create_month_plan_handler),
        )
        .route(
            "/v1/planning/month-plans/:id",
            get(get_month_plan_handler)
                .patch(patch_month_plan_handler)
                .delete(delete_month_plan_handler),
        )
        // Cutover feature gates — Desktop backend phase 2 (now implemented).
        // Static sub-paths before parameterised routes to satisfy matchit ordering.
        .route("/v1/recipes/preview", post(preview_recipe_handler))
        .route(
            "/v1/saved-weekplans/:id/consolidate-shopping-list",
            post(consolidate_shopping_list_handler),
        )
        .route(
            "/v1/saved-weekplans/:id/consolidated-shopping-list",
            get(get_consolidated_shopping_list_handler).put(put_consolidated_shopping_list_handler),
        )
        .route_layer(middleware::from_fn_with_state(state.clone(), token_gate));

    Router::new()
        .route("/health", get(health_handler))
        // Unauthenticated image serve route — outside the token-gated /api nest
        .route("/recipe-images/:filename", get(serve_image_handler))
        .nest("/api", api_routes)
        // request_context_layer runs on every route (including /health) so Trace ID is always set
        .layer(middleware::from_fn_with_state(state.clone(), request_context_layer))
        .with_state(state)
}

/// Liveness probe — mirrors the Nitro `/health` contract (`{"ok": true}`, 200).
async fn health_handler() -> Json<Value> {
    Json(json!({ "ok": true }))
}

/// Test-only stub route that proves **Trace ID** + **Planning Principal** resolution and
/// emits a structured log line with a `domain.action` **Log Event Name**.
async fn stub_handler(
    Extension(ctx): Extension<RequestContext>,
) -> Result<Json<Value>, AppError> {
    log::info!(
        "desktop.request_context.resolved traceId={} planningUserId={}",
        ctx.trace_id,
        ctx.planning_principal.user_id
    );

    Ok(Json(json!({
        "traceId": ctx.trace_id,
        "planningUserId": ctx.planning_principal.user_id,
    })))
}
