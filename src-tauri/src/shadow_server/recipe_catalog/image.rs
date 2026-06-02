//! Recipe image upload and serve handlers.
//!
//! - `POST /api/v1/recipes/upload-image` — multipart upload via [`RecipeImageStore`]
//! - `GET /recipe-images/:filename` — unauthenticated serve (outside token-gated `/api`)

use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::header,
    response::{IntoResponse, Response},
    Json,
};

use crate::shadow_server::{
    error::AppError,
    recipe_catalog::application::{
        serve_recipe_image::{self, ServeRecipeImageError},
        upload_recipe_image::{self, UploadRecipeImageError},
    },
    routes::AppState,
};

fn map_upload_error(e: UploadRecipeImageError) -> AppError {
    match e {
        UploadRecipeImageError::BadRequest(msg) => AppError::bad_request(msg),
        UploadRecipeImageError::Repo(repo) => AppError::from_recipe_catalog_repo(repo),
    }
}

fn map_serve_error(e: ServeRecipeImageError) -> AppError {
    match e {
        ServeRecipeImageError::BadRequest(msg) => AppError::bad_request(msg),
        ServeRecipeImageError::Repo(repo) => AppError::from_recipe_catalog_repo(repo),
    }
}

/// `POST /api/v1/recipes/upload-image`
pub async fn upload_image_handler(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, AppError> {
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut file_name_hint: Option<String> = None;
    let mut content_type_hint: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::bad_request(e.to_string()))?
    {
        if field.name() == Some("file") {
            file_name_hint = field.file_name().map(|s| s.to_string());
            content_type_hint = field.content_type().map(|s| s.to_string());
            let bytes = field
                .bytes()
                .await
                .map_err(|e| AppError::bad_request(e.to_string()))?;
            file_bytes = Some(bytes.to_vec());
            break;
        }
    }

    let bytes = file_bytes
        .filter(|b| !b.is_empty())
        .ok_or_else(|| AppError::bad_request("Choose an image file to upload."))?;

    let mime = upload_recipe_image::resolve_mime(
        content_type_hint.as_deref(),
        file_name_hint.as_deref(),
    )
    .map_err(AppError::bad_request)?;

    let images = state.recipe_images.clone();
    let stored = tokio::task::spawn_blocking(move || {
        upload_recipe_image::execute(images.as_ref(), bytes, &mime)
    })
    .await
    .map_err(|e| AppError::internal(format!("task panicked: {e}")))?
    .map_err(map_upload_error)?;

    let origin = headers
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .map(|host| format!("http://{host}"))
        .unwrap_or_else(|| format!("http://127.0.0.1:{}", state.port));

    let url = format!("{origin}/recipe-images/{}", stored.filename);
    Ok(Json(serde_json::json!({ "url": url })))
}

/// `GET /recipe-images/:filename` — serves a stored recipe image (unauthenticated).
pub async fn serve_image_handler(
    State(state): State<AppState>,
    Path(filename): Path<String>,
) -> Result<Response, AppError> {
    let images = state.recipe_images.clone();
    let payload = tokio::task::spawn_blocking(move || {
        serve_recipe_image::execute(images.as_ref(), &filename)
    })
    .await
    .map_err(|e| AppError::internal(format!("task panicked: {e}")))?
    .map_err(map_serve_error)?;

    let response = Response::builder()
        .header(header::CONTENT_TYPE, payload.content_type)
        .header(header::CACHE_CONTROL, "public, max-age=86400")
        .body(Body::from(payload.bytes))
        .map_err(|e| AppError::internal(format!("build response: {e}")))?;

    Ok(response)
}
