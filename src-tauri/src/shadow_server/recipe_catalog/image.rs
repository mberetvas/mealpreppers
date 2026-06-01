//! Recipe image upload and serve handlers.
//!
//! - `POST /api/v1/recipes/upload-image` — accepts `multipart/form-data` with a `file` field,
//!   validates MIME type (JPEG/PNG/WebP/GIF) and size (≤ 5 MB), writes to
//!   `{data_dir}/recipe-images/{uuid}.{ext}`, and returns `{ url }` pointing at the
//!   loopback serve route.
//!
//! - `GET /recipe-images/:filename` — serves the stored image file with the correct
//!   `Content-Type` and `Cache-Control` headers.  This route is **unauthenticated**
//!   (mounted outside the token-gated `/api` sub-router).

use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::header,
    response::{IntoResponse, Response},
    Json,
};
use std::path::PathBuf;
use uuid::Uuid;

use crate::shadow_server::{error::AppError, routes::AppState};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_BYTES: usize = 5 * 1024 * 1024;

fn mime_to_ext(mime: &str) -> Option<&'static str> {
    match mime {
        "image/jpeg" => Some("jpg"),
        "image/png" => Some("png"),
        "image/webp" => Some("webp"),
        "image/gif" => Some("gif"),
        _ => None,
    }
}

fn ext_to_mime(ext: &str) -> Option<&'static str> {
    match ext {
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "webp" => Some("image/webp"),
        "gif" => Some("image/gif"),
        _ => None,
    }
}

/// Returns `true` for filenames that match `{uuid}.{ext}` (safe subset only).
fn is_safe_image_filename(filename: &str) -> bool {
    let Some((name, ext)) = filename.split_once('.') else {
        return false;
    };

    // Extension must be one of the supported image types
    if ext_to_mime(&ext.to_lowercase()).is_none() {
        return false;
    }

    // Name must be a 36-character UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    if name.len() != 36 {
        return false;
    }

    let bytes = name.as_bytes();
    let hyphen_positions = [8usize, 13, 18, 23];
    for (i, &b) in bytes.iter().enumerate() {
        if hyphen_positions.contains(&i) {
            if b != b'-' {
                return false;
            }
        } else if !b.is_ascii_hexdigit() {
            return false;
        }
    }

    true
}

// ---------------------------------------------------------------------------
// Upload handler
// ---------------------------------------------------------------------------

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
            break; // only the first `file` field matters
        }
    }

    let bytes = file_bytes
        .filter(|b| !b.is_empty())
        .ok_or_else(|| AppError::bad_request("Choose an image file to upload."))?;

    if bytes.len() > MAX_BYTES {
        return Err(AppError::bad_request(
            "Image must be at most 5MB.",
        ));
    }

    // Resolve MIME: prefer the multipart content-type header, fall back to filename extension.
    let mime = content_type_hint
        .as_deref()
        .filter(|m| mime_to_ext(m).is_some())
        .or_else(|| {
            file_name_hint
                .as_deref()
                .and_then(|n| n.rsplit('.').next())
                .and_then(|ext| {
                    let lower = ext.to_lowercase();
                    ext_to_mime(lower.as_str())
                })
        })
        .ok_or_else(|| {
            AppError::bad_request("Use a JPEG, PNG, WebP, or GIF image.")
        })?;

    let ext = mime_to_ext(mime).expect("mime already validated");
    let filename = format!("{}.{ext}", Uuid::new_v4());

    // Ensure the images directory exists
    let images_dir = state.recipe_images_dir();
    tokio::fs::create_dir_all(&images_dir)
        .await
        .map_err(|e| AppError::internal(format!("create images dir: {e}")))?;

    let file_path = images_dir.join(&filename);
    tokio::fs::write(&file_path, &bytes)
        .await
        .map_err(|e| AppError::internal(format!("write image: {e}")))?;

    // Derive the loopback origin from the Host header (matches TypeScript behaviour).
    let origin = headers
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .map(|host| format!("http://{host}"))
        .unwrap_or_else(|| format!("http://127.0.0.1:{}", state.port));

    let url = format!("{origin}/recipe-images/{filename}");
    Ok(Json(serde_json::json!({ "url": url })))
}

// ---------------------------------------------------------------------------
// Serve handler
// ---------------------------------------------------------------------------

/// `GET /recipe-images/:filename` — serves a stored recipe image (unauthenticated).
pub async fn serve_image_handler(
    State(state): State<AppState>,
    Path(filename): Path<String>,
) -> Result<Response, AppError> {
    if !is_safe_image_filename(&filename) {
        return Err(AppError::bad_request("Invalid image filename."));
    }

    let ext = filename.rsplit('.').next().unwrap_or("").to_lowercase();
    let content_type =
        ext_to_mime(&ext).ok_or_else(|| AppError::bad_request("Unsupported image type."))?;

    let file_path: PathBuf = state.recipe_images_dir().join(&filename);

    let bytes = tokio::fs::read(&file_path)
        .await
        .map_err(|_| AppError::not_found("Image not found."))?;

    let response = Response::builder()
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, "public, max-age=86400")
        .body(Body::from(bytes))
        .map_err(|e| AppError::internal(format!("build response: {e}")))?;

    Ok(response)
}
