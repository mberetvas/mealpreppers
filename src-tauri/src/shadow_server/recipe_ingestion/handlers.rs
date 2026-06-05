//! HTTP handler for `POST /api/v1/recipes/preview`.

use axum::{extract::State, response::Json};
use tokio::task::spawn_blocking;

use crate::shadow_server::{error::AppError, routes::AppState};
use super::models::{RecipePreviewRequest, RecipePreviewResponse};
use super::scraper::canonical_recipe_host;

// #region agent log
fn agent_debug_log(
    hypothesis_id: &str,
    location: &str,
    message: &str,
    data: serde_json::Value,
) {
    use std::io::Write;
    let payload = serde_json::json!({
        "sessionId": "fafd41",
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data,
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0),
    });
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(r"d:\Projecten_Thuis\mealpreppers\debug-fafd41.log")
    {
        let _ = writeln!(file, "{payload}");
    }
}
// #endregion

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
    let host = canonical_recipe_host(&url);
    // #region agent log
    agent_debug_log(
        "D",
        "handlers.rs:host_check",
        "canonical host resolved",
        serde_json::json!({ "url": url, "host": host }),
    );
    // #endregion
    if host.is_none() {
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
        // #region agent log
        agent_debug_log(
            "A",
            "handlers.rs:fetch_err",
            "fetch_recipe_page_html failed",
            serde_json::json!({ "url": url, "error": e.to_string() }),
        );
        // #endregion
        AppError::bad_gateway("The recipe page could not be fetched.")
    })?;

    // #region agent log
    agent_debug_log(
        "A",
        "handlers.rs:fetch_ok",
        "fetch completed",
        serde_json::json!({
            "url": url,
            "status": fetch_result.status,
            "htmlLen": fetch_result.html.len(),
            "finalUrl": fetch_result.final_url,
        }),
    );
    // #endregion

    if !(200..300).contains(&fetch_result.status) {
        return Err(AppError::bad_gateway("The recipe page could not be fetched."));
    }

    let html = fetch_result.html;
    let final_url = fetch_result.final_url;

    // Auth wall detection.
    let auth_wall = super::fetch::detect_publisher_auth_wall(&html, &final_url);
    // #region agent log
    agent_debug_log(
        "B",
        "handlers.rs:auth_wall",
        "auth wall detection",
        serde_json::json!({
            "authWall": auth_wall,
            "hasRecipeDetail": html.contains("id=\"recipe-detail\""),
            "hasIngredients": html.contains("itemprop=\"recipeIngredient\""),
        }),
    );
    // #endregion
    if auth_wall {
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
        .map_err(|e| {
            // #region agent log
            agent_debug_log(
                "C",
                "handlers.rs:parse_err",
                "parse_recipe_html failed",
                serde_json::json!({ "url": url, "error": e.to_string() }),
            );
            // #endregion
            AppError::bad_request(e)
        })?;

    // #region agent log
    agent_debug_log(
        "C",
        "handlers.rs:parse_ok",
        "parse completed",
        serde_json::json!({
            "titleLen": result.draft.title.trim().len(),
            "ingredientCount": result.draft.ingredients.len(),
            "stepCount": result.draft.steps.len(),
        }),
    );
    // #endregion

    if result.draft.title.trim().is_empty() && result.draft.ingredients.is_empty() {
        // #region agent log
        agent_debug_log(
            "C",
            "handlers.rs:empty_draft",
            "draft empty after parse",
            serde_json::json!({ "url": url }),
        );
        // #endregion
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
