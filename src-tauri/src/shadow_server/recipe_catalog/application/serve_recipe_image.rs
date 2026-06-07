//! Read a recipe image by filename for the unauthenticated serve route.

use crate::shadow_server::{
    platform::RepoError,
    recipe_catalog::{
        application::image_validation::is_safe_filename,
        ports::recipe_image_store::{RecipeImagePayload, RecipeImageStore},
    },
};

#[derive(Debug)]
pub enum ServeRecipeImageError {
    BadRequest(&'static str),
    Repo(RepoError),
}

pub fn execute(
    store: &dyn RecipeImageStore,
    filename: &str,
) -> Result<RecipeImagePayload, ServeRecipeImageError> {
    if !is_safe_filename(filename) {
        return Err(ServeRecipeImageError::BadRequest("Invalid image filename."));
    }

    store
        .read_image(filename)
        .map_err(ServeRecipeImageError::Repo)
}
