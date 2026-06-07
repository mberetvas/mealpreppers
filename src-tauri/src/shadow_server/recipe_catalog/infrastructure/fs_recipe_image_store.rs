//! Filesystem implementation of [`RecipeImageStore`].

use std::{fs, path::PathBuf};

use uuid::Uuid;

use crate::shadow_server::{
    platform::RepoError,
    recipe_catalog::{
        application::image_validation::{ext_for_mime, mime_for_ext},
        ports::{
            recipe_image_store::{RecipeImagePayload, RecipeImageStore, StoredRecipeImage},
        },
    },
};

/// Install-scoped adapter that stores recipe images under `{data_dir}/recipe-images/`.
pub struct FsRecipeImageStore {
    images_dir: PathBuf,
}

impl FsRecipeImageStore {
    pub fn new(images_dir: PathBuf) -> Self {
        Self { images_dir }
    }
}

impl RecipeImageStore for FsRecipeImageStore {
    fn store_image(&self, bytes: &[u8], mime: &str) -> Result<StoredRecipeImage, RepoError> {
        let ext = ext_for_mime(mime).ok_or_else(|| {
            RepoError::Storage(format!("unsupported mime for store: {mime}"))
        })?;

        fs::create_dir_all(&self.images_dir).map_err(|e| RepoError::Storage(e.to_string()))?;

        let filename = format!("{}.{ext}", Uuid::new_v4());
        let file_path = self.images_dir.join(&filename);
        fs::write(&file_path, bytes).map_err(|e| RepoError::Storage(e.to_string()))?;

        Ok(StoredRecipeImage { filename })
    }

    fn read_image(&self, filename: &str) -> Result<RecipeImagePayload, RepoError> {
        let ext = filename
            .rsplit('.')
            .next()
            .unwrap_or("")
            .to_lowercase();
        let content_type = mime_for_ext(&ext)
            .ok_or_else(|| RepoError::Storage("unsupported image extension".to_string()))?
            .to_string();

        let file_path = self.images_dir.join(filename);
        let bytes = fs::read(&file_path).map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                RepoError::NotFound("Image not found.".to_string())
            } else {
                RepoError::Storage(e.to_string())
            }
        })?;

        Ok(RecipeImagePayload {
            bytes,
            content_type,
        })
    }
}
