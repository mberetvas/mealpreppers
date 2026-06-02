//! HTTP handlers for the Shopping List consolidation endpoints.
//!
//! # Routes
//! - `POST /api/v1/saved-weekplans/:id/consolidate-shopping-list`
//! - `GET  /api/v1/saved-weekplans/:id/consolidated-shopping-list`
//! - `PUT  /api/v1/saved-weekplans/:id/consolidated-shopping-list`

use axum::{
    extract::{Extension, Json, Path, State},
    response::IntoResponse,
};
use tokio::task::spawn_blocking;

use crate::shadow_server::{
    error::AppError,
    planning::repository::open_conn,
    request_context::RequestContext,
    routes::AppState,
};
use super::{
    consolidation::consolidate_shopping_list,
    models::{ConsolidatedShoppingListPutPayload, SavedConsolidatedShoppingListRecord},
    repository::{get_consolidated_shopping_list, save_consolidated_shopping_list},
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// Consolidates the shopping list for a saved weekplan.
///
/// Exact-merges all recipe ingredients; optionally polishes with OpenRouter AI
/// when the key is present in the OS keychain.
pub async fn consolidate_shopping_list_handler(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = ctx.planning_principal.user_id;
    let db_path = state.db_path();
    let openrouter_key = crate::keychain::read_openrouter_key();

    let result =
        consolidate_shopping_list(id, user_id, db_path, openrouter_key).await?;

    Ok(Json(result))
}

// ---------------------------------------------------------------------------
// GET /:id/consolidated-shopping-list
// ---------------------------------------------------------------------------

/// Returns the saved consolidated shopping list for a weekplan.
///
/// Returns `404` when no saved list exists or the weekplan is not found.
pub async fn get_consolidated_shopping_list_handler(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Path(id): Path<String>,
) -> Result<Json<SavedConsolidatedShoppingListRecord>, AppError> {
    let user_id = ctx.planning_principal.user_id;
    let db_path = state.db_path();

    let record = spawn_blocking(move || {
        let conn = open_conn(&db_path).map_err(AppError::from_shopping_list_repo)?;
        get_consolidated_shopping_list(&conn, &id, &user_id).map_err(AppError::from_shopping_list_repo)
    })
    .await
    .map_err(|e| AppError::internal(format!("task panicked: {e}")))??;

    Ok(Json(record))
}

// ---------------------------------------------------------------------------
// PUT /:id/consolidated-shopping-list
// ---------------------------------------------------------------------------

/// Saves (creates or replaces) the consolidated shopping list for a weekplan.
pub async fn put_consolidated_shopping_list_handler(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Path(id): Path<String>,
    Json(payload): Json<ConsolidatedShoppingListPutPayload>,
) -> Result<Json<SavedConsolidatedShoppingListRecord>, AppError> {
    let user_id = ctx.planning_principal.user_id;
    let db_path = state.db_path();

    let record = SavedConsolidatedShoppingListRecord {
        lines: payload.lines,
        source_fingerprint: payload.source_fingerprint,
        confirmed_at: chrono::Utc::now()
            .format("%Y-%m-%dT%H:%M:%S%.3fZ")
            .to_string(),
    };

    let saved = spawn_blocking(move || {
        let mut conn = open_conn(&db_path).map_err(AppError::from_shopping_list_repo)?;
        save_consolidated_shopping_list(&mut conn, &id, &user_id, &record)
            .map_err(AppError::from_shopping_list_repo)
    })
    .await
    .map_err(|e| AppError::internal(format!("task panicked: {e}")))??;

    Ok(Json(saved))
}
