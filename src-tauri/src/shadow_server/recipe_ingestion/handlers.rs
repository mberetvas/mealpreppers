//! HTTP handler for `POST /api/v1/recipes/preview`.

use axum::{extract::State, response::Json};
use tokio::task::spawn_blocking;

use crate::shadow_server::{error::AppError, routes::AppState};
use super::models::{RecipePreviewRequest, RecipePreviewResponse};
use super::scraper::canonical_recipe_host;

/// POST /api/v1/recipes/preview
///
/// Accepts `{ "url": "https://..." }` and returns `{ draft, warnings }`.
///
/// Error codes:
/// - `400` — missing or unsupported URL  
/// - `403` — publisher auth wall  
/// - `502` — HTML fetch failed
pub async fn preview_recipe_handler(
    State(state): State<AppState>,
    Json(payload): Json<RecipePreviewRequest>,
) -> Result<Json<RecipePreviewResponse>, AppError> {
    let _ = state;

    let url = payload
        .url
        .as_deref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::bad_request("url is required"))?;

    // Validate supported host before making any network call.
    if canonical_recipe_host(&url).is_none() {
        return Err(AppError::bad_request(
            "This recipe source is not supported.",
        ));
    }

    let url_clone = url.clone();
    let fetch_result = spawn_blocking(move || {
        super::fetch::fetch_recipe_page_html(&url_clone)
    })
    .await
    .map_err(|e| AppError::internal(format!("spawn error: {e}")))?
    .map_err(|e| {
        log::warn!("recipe_preview.fetch_error url={url} error={e}");
        AppError::bad_gateway("The recipe page could not be fetched.")
    })?;

    if !(200..300).contains(&fetch_result.status) {
        return Err(AppError::bad_gateway("The recipe page could not be fetched."));
    }

    let html = fetch_result.html;
    let final_url = fetch_result.final_url;

    // Auth wall detection.
    if super::fetch::detect_publisher_auth_wall(&html, &final_url) {
        return Err(AppError::unprocessable(
            "The publisher returned a login page instead of the recipe. \
            This importer only reads pages that are available without an account. \
            Open the recipe in a private window: if it asks you to sign in, use manual entry or another source.",
        ));
    }

    let url_clone2 = url.clone();
    let result = spawn_blocking(move || super::scraper::parse_recipe_html(&html, &url_clone2))
        .await
        .map_err(|e| AppError::internal(format!("spawn error: {e}")))?
        .map_err(|e| AppError::bad_request(e))?;

    if result.draft.title.trim().is_empty() && result.draft.ingredients.is_empty() {
        return Err(AppError::unprocessable(
            "The recipe could not be parsed from this page. The page may not contain recipe data, \
            or the site layout may have changed. Try manual entry or another source.",
        ));
    }

    log::info!(
        "recipe_preview.scraped url={url} title={:?} ingredients={}",
        result.draft.title,
        result.draft.ingredients.len()
    );

    Ok(Json(RecipePreviewResponse {
        draft: result.draft,
        warnings: result.warnings,
    }))
}
