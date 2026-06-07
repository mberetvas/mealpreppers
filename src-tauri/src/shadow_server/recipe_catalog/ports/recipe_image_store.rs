//! Recipe Catalog image filesystem port (upload + serve).

use crate::shadow_server::platform::RepoError;

/// Stored image metadata returned after a successful upload.
#[derive(Debug, Clone)]
pub struct StoredRecipeImage {
    pub filename: String,
}

/// Bytes and MIME type for a served recipe image.
#[derive(Debug, Clone)]
pub struct RecipeImagePayload {
    pub bytes: Vec<u8>,
    pub content_type: String,
}

/// Persistence port for install-scoped recipe image files.
pub trait RecipeImageStore: Send + Sync {
    /// Writes validated image bytes and returns the generated filename (`{uuid}.{ext}`).
    fn store_image(&self, bytes: &[u8], mime: &str) -> Result<StoredRecipeImage, RepoError>;

    /// Reads image bytes by filename; returns [`RepoError::NotFound`] when missing.
    fn read_image(&self, filename: &str) -> Result<RecipeImagePayload, RepoError>;
}
