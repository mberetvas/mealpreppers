//! Axum route handlers for the Recipe Catalog endpoints.
//!
//! Every handler opens a fresh SQLite connection inside `tokio::task::spawn_blocking`
//! to keep blocking I/O off the async executor thread.
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
use std::collections::BTreeSet;

use crate::shadow_server::{
    error::AppError,
    platform::RepoError,
    recipe_catalog::{
        defaults::{DEFAULT_CATEGORIES, DEFAULT_TAGS},
        models::{BulkDeleteRequest, RecipeCreatePayload, RecipeCatalogItem},
        repository::{
            create_recipe, delete_recipes_by_ids, get_recipe_by_id, list_recipes,
            list_stored_options, open_conn, update_recipe,
        },
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
        return Err(AppError::bad_request(
            "At least one recipe ID is required.",
        ));
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
    let db_path = state.db_path();
    let items = tokio::task::spawn_blocking(move || -> Result<Vec<RecipeCatalogItem>, RepoError> {
        let conn = open_conn(&db_path)?;
        list_recipes(&conn)
    })
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

    let db_path = state.db_path();
    let item = tokio::task::spawn_blocking(move || -> Result<RecipeCatalogItem, RepoError> {
        let mut conn = open_conn(&db_path)?;
        create_recipe(&mut conn, payload)
    })
    .await
    .map_err(|e| AppError::internal(format!("task panicked: {e}")))?
    .map_err(AppError::from_recipe_catalog_repo)?;

    Ok((StatusCode::OK, Json(item)))
}

/// `GET /api/v1/recipes/options` — distinct categories and tags merged with defaults.
pub async fn options_handler(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, AppError> {
    let db_path = state.db_path();
    let (stored_cats, stored_tags) =
        tokio::task::spawn_blocking(
            move || -> Result<(Vec<String>, Vec<String>), RepoError> {
                let conn = open_conn(&db_path)?;
                list_stored_options(&conn)
            },
        )
        .await
        .map_err(|e| AppError::internal(format!("task panicked: {e}")))?
        .map_err(AppError::from_recipe_catalog_repo)?;

    // Merge defaults with stored values; BTreeSet gives sorted, deduplicated output.
    let mut categories: BTreeSet<String> =
        DEFAULT_CATEGORIES.iter().map(|s| s.to_string()).collect();
    let mut tags: BTreeSet<String> = DEFAULT_TAGS.iter().map(|s| s.to_string()).collect();

    for c in stored_cats {
        categories.insert(c);
    }
    for t in stored_tags {
        tags.insert(t);
    }

    let body = serde_json::json!({
        "categories": categories.into_iter().collect::<Vec<_>>(),
        "tags": tags.into_iter().collect::<Vec<_>>(),
    });

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

    let db_path = state.db_path();
    let deleted = tokio::task::spawn_blocking(move || -> Result<usize, RepoError> {
        let conn = open_conn(&db_path)?;
        delete_recipes_by_ids(&conn, &unique_ids)
    })
    .await
    .map_err(|e| AppError::internal(format!("task panicked: {e}")))?
    .map_err(AppError::from_recipe_catalog_repo)?;

    Ok(Json(serde_json::json!({ "deleted": deleted })))
}

/// `GET /api/v1/recipes/:id` — returns a single recipe or 404.
pub async fn get_recipe_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<RecipeCatalogItem>, AppError> {
    let db_path = state.db_path();
    let item = tokio::task::spawn_blocking(move || -> Result<RecipeCatalogItem, RepoError> {
        let conn = open_conn(&db_path)?;
        get_recipe_by_id(&conn, &id)
    })
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

    let db_path = state.db_path();
    let item = tokio::task::spawn_blocking(move || -> Result<RecipeCatalogItem, RepoError> {
        let mut conn = open_conn(&db_path)?;
        update_recipe(&mut conn, &id, payload)
    })
    .await
    .map_err(|e| AppError::internal(format!("task panicked: {e}")))?
    .map_err(AppError::from_recipe_catalog_repo)?;

    Ok(Json(item))
}
