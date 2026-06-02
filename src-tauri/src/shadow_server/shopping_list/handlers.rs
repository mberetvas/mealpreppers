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
    request_context::RequestContext,
    routes::AppState,
    shopping_list::{
        application::{
            consolidate_shopping_list, get_consolidated_shopping_list,
            save_consolidated_shopping_list,
        },
        models::ConsolidatedShoppingListPutPayload,
    },
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
    let weekplan_reader = state.weekplan_for_consolidation.clone();
    let recipes = state.recipes.clone();
    let openrouter_key = crate::keychain::read_openrouter_key();

    let result = consolidate_shopping_list(
        weekplan_reader,
        recipes,
        &id,
        &user_id,
        openrouter_key,
    )
    .await?;

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
) -> Result<impl IntoResponse, AppError> {
    let user_id = ctx.planning_principal.user_id;
    let consolidated = state.consolidated_shopping_lists.clone();

    let record = spawn_blocking(move || {
        get_consolidated_shopping_list(consolidated.as_ref(), &id, &user_id)
            .map_err(AppError::from_shopping_list_repo)
    })
    .await
    .map_err(|e| AppError::internal(format!("task panicked: {e}")))??;

    Ok(Json(record))
}

// ---------------------------------------------------------------------------
// PUT /:id/consolidated-shopping-list
// ---------------------------------------------------------------------------

fn validate_put_payload(payload: &ConsolidatedShoppingListPutPayload) -> Result<(), AppError> {
    if payload.lines.is_empty() {
        return Err(AppError::bad_request(
            "Request body must include at least one line.",
        ));
    }
    for line in &payload.lines {
        if line.id.trim().is_empty() || line.name.trim().is_empty() {
            return Err(AppError::bad_request("Invalid line shape."));
        }
    }
    Ok(())
}

/// Saves (creates or replaces) the consolidated shopping list for a weekplan.
///
/// Server-computes `sourceFingerprint` from the weekplan body (mirrors TypeScript
/// `saveConsolidatedShoppingList`); any client-supplied fingerprint is ignored.
pub async fn put_consolidated_shopping_list_handler(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Path(id): Path<String>,
    Json(payload): Json<ConsolidatedShoppingListPutPayload>,
) -> Result<impl IntoResponse, AppError> {
    validate_put_payload(&payload)?;

    let user_id = ctx.planning_principal.user_id;
    let reader = state.saved_weekplan_reader.clone();
    let consolidated = state.consolidated_shopping_lists.clone();
    let lines = payload.lines;

    let saved = spawn_blocking(move || {
        save_consolidated_shopping_list(
            reader.as_ref(),
            consolidated.as_ref(),
            &id,
            &user_id,
            lines,
        )
        .map_err(AppError::from_shopping_list_repo)
    })
    .await
    .map_err(|e| AppError::internal(format!("task panicked: {e}")))??;

    Ok(Json(saved))
}
