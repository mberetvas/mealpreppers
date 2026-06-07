//! Axum route handlers for install-scoped settings.
//!
//! - `GET   /api/v1/settings` — read install settings
//! - `PATCH /api/v1/settings` — update OpenRouter shopping-list polish model

use axum::{
    extract::{Json, State},
    response::IntoResponse,
};
use serde::Deserialize;
use serde_json::json;

use crate::shadow_server::{
    error::AppError,
    planning::repository::open_conn,
    routes::AppState,
    settings::repository::{get_install_settings, update_shopping_list_model, validate_shopping_list_model},
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallSettingsPatchBody {
    openrouter_shopping_list_model: String,
}

/// `GET /api/v1/settings` — returns install-scoped settings.
pub async fn get_settings_handler(State(state): State<AppState>) -> Result<impl IntoResponse, AppError> {
    let db_path = state.db_path();

    let settings = tokio::task::spawn_blocking(move || {
        let conn = open_conn(&db_path)?;
        get_install_settings(&conn)
    })
    .await
    .map_err(|e| AppError::internal(format!("task panicked: {e}")))?
    .map_err(AppError::from_shopping_list_repo)?;

    Ok(Json(json!({
        "openrouterShoppingListModel": settings.openrouter_shopping_list_model,
    })))
}

/// `PATCH /api/v1/settings` — updates the OpenRouter shopping-list polish model.
pub async fn patch_settings_handler(
    State(state): State<AppState>,
    Json(body): Json<InstallSettingsPatchBody>,
) -> Result<impl IntoResponse, AppError> {
    validate_shopping_list_model(&body.openrouter_shopping_list_model)
        .map_err(AppError::bad_request)?;

    let db_path = state.db_path();
    let trimmed = body.openrouter_shopping_list_model.trim().to_string();

    let settings = tokio::task::spawn_blocking(move || {
        let mut conn = open_conn(&db_path)?;
        update_shopping_list_model(&mut conn, &trimmed)
    })
    .await
    .map_err(|e| AppError::internal(format!("task panicked: {e}")))?
    .map_err(AppError::from_shopping_list_repo)?;

    Ok(Json(json!({
        "openrouterShoppingListModel": settings.openrouter_shopping_list_model,
    })))
}
