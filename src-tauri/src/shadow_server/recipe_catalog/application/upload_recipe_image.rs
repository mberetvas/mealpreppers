//! Store a validated recipe image and return its filename.

use crate::shadow_server::{
    platform::RepoError,
    recipe_catalog::{
        application::image_validation::{ext_for_mime, mime_for_ext, validate_upload},
        ports::recipe_image_store::{RecipeImageStore, StoredRecipeImage},
    },
};

#[derive(Debug)]
pub enum UploadRecipeImageError {
    BadRequest(&'static str),
    Repo(RepoError),
}

/// Resolves a supported MIME from multipart content-type or filename extension.
pub fn resolve_mime(
    content_type: Option<&str>,
    file_name: Option<&str>,
) -> Result<String, &'static str> {
    if let Some(mime) = content_type.filter(|m| ext_for_mime(m).is_some()) {
        return Ok(mime.to_string());
    }

    file_name
        .and_then(|n| n.rsplit('.').next())
        .and_then(|ext| mime_for_ext(&ext.to_lowercase()))
        .map(str::to_string)
        .ok_or("Use a JPEG, PNG, WebP, or GIF image.")
}

pub fn execute(
    store: &dyn RecipeImageStore,
    bytes: Vec<u8>,
    mime: &str,
) -> Result<StoredRecipeImage, UploadRecipeImageError> {
    validate_upload(mime, bytes.len()).map_err(UploadRecipeImageError::BadRequest)?;
    store
        .store_image(&bytes, mime)
        .map_err(UploadRecipeImageError::Repo)
}
