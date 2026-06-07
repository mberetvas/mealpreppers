//! Axum route handlers for the Recipe Catalog endpoints.
//!
//! Handlers delegate to `application/` use cases via wired ports on [`AppState`].
//!
//! # Routes
//! - `GET  /api/v1/recipes`            — list all recipes
//! - `POST /api/v1/recipes`            — create recipe
//! - `GET  /api/v1/recipes/options`    — distinct categories + tags merged with defaults
//! - `POST /api/v1/recipes/bulk-delete` — delete multiple recipes by ID
//! - `GET  /api/v1/recipes/:id`        — get recipe by ID
//! - `PUT  /api/v1/recipes/:id`        — update recipe

use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    response::IntoResponse,
};

use crate::shadow_server::{
    error::AppError,
    recipe_catalog::{
        application::{
            bulk_delete_recipes, create_recipe, get_recipe, list_recipes, recipe_options,
            update_recipe,
        },
        models::{BulkDeleteRequest, RecipeCatalogItem, RecipeCreatePayload},
    },
    routes::AppState,
};

// ---------------------------------------------------------------------------
// Payload validation
// ---------------------------------------------------------------------------

fn validate_create_payload(payload: &RecipeCreatePayload) -> Result<(), AppError> {
    if payload.title.trim().is_empty() {
        return Err(AppError::bad_request("Recipe title is required."));
    }
    if payload.ingredients.is_empty() {
        return Err(AppError::bad_request(
            "At least one ingredient is required.",
        ));
    }
    Ok(())
}

fn validate_bulk_delete(req: &BulkDeleteRequest) -> Result<(), AppError> {
    if req.ids.is_empty() {
        return Err(AppError::bad_request("At least one recipe ID is required."));
    }
    if req.ids.len() > 200 {
        return Err(AppError::bad_request(
            "At most 200 recipe IDs may be deleted at once.",
        ));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/v1/recipes` — returns all recipes ordered by creation date descending.
pub async fn list_recipes_handler(
    State(state): State<AppState>,
) -> Result<Json<Vec<RecipeCatalogItem>>, AppError> {
    let recipes = state.recipes.clone();
    let items = tokio::task::spawn_blocking(move || list_recipes::execute(recipes.as_ref()))
        .await
        .map_err(|e| AppError::internal(format!("task panicked: {e}")))?
        .map_err(AppError::from_recipe_catalog_repo)?;

    Ok(Json(items))
}

/// `POST /api/v1/recipes` — creates a recipe; returns the persisted item.
pub async fn create_recipe_handler(
    State(state): State<AppState>,
    Json(payload): Json<RecipeCreatePayload>,
) -> Result<impl IntoResponse, AppError> {
    validate_create_payload(&payload)?;

    let recipes = state.recipes.clone();
    let item =
        tokio::task::spawn_blocking(move || create_recipe::execute(recipes.as_ref(), payload))
            .await
            .map_err(|e| AppError::internal(format!("task panicked: {e}")))?
            .map_err(AppError::from_recipe_catalog_repo)?;

    Ok((StatusCode::OK, Json(item)))
}

/// `GET /api/v1/recipes/options` — distinct categories and tags merged with defaults.
pub async fn options_handler(State(state): State<AppState>) -> Result<impl IntoResponse, AppError> {
    let recipes = state.recipes.clone();
    let body = tokio::task::spawn_blocking(move || recipe_options::execute(recipes.as_ref()))
        .await
        .map_err(|e| AppError::internal(format!("task panicked: {e}")))?
        .map_err(AppError::from_recipe_catalog_repo)?;

    Ok(Json(body))
}

/// `POST /api/v1/recipes/bulk-delete` — deletes recipes by ID; returns `{ deleted: count }`.
pub async fn bulk_delete_handler(
    State(state): State<AppState>,
    Json(req): Json<BulkDeleteRequest>,
) -> Result<impl IntoResponse, AppError> {
    validate_bulk_delete(&req)?;

    // De-duplicate IDs
    let unique_ids: Vec<String> = {
        let mut seen = std::collections::HashSet::new();
        req.ids
            .into_iter()
            .filter(|id| seen.insert(id.clone()))
            .collect()
    };

    let recipes = state.recipes.clone();
    let deleted = tokio::task::spawn_blocking(move || {
        bulk_delete_recipes::execute(recipes.as_ref(), &unique_ids)
    })
    .await
    .map_err(|e| AppError::internal(format!("task panicked: {e}")))?
    .map_err(AppError::from_recipe_catalog_repo)?;

    Ok(Json(serde_json::json!({ "deleted": deleted })))
}

/// `GET /api/v1/recipes/:id` — returns a single recipe or 404 (no Planning Principal check).
pub async fn get_recipe_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<RecipeCatalogItem>, AppError> {
    let recipes = state.recipes.clone();
    let item = tokio::task::spawn_blocking(move || get_recipe::execute(recipes.as_ref(), &id))
        .await
        .map_err(|e| AppError::internal(format!("task panicked: {e}")))?
        .map_err(AppError::from_recipe_catalog_repo)?;

    Ok(Json(item))
}

/// `PUT /api/v1/recipes/:id` — replaces a recipe or returns 404.
pub async fn update_recipe_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<RecipeCreatePayload>,
) -> Result<impl IntoResponse, AppError> {
    validate_create_payload(&payload)?;

    let recipes = state.recipes.clone();
    let item =
        tokio::task::spawn_blocking(move || update_recipe::execute(recipes.as_ref(), &id, payload))
            .await
            .map_err(|e| AppError::internal(format!("task panicked: {e}")))?
            .map_err(AppError::from_recipe_catalog_repo)?;

    Ok(Json(item))
}
