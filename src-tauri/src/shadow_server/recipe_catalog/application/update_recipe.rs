//! Replace a recipe in the catalog.

use crate::shadow_server::{
    platform::RepoError,
    recipe_catalog::{
        models::RecipeCatalogItem, models::RecipeUpdatePayload, ports::RecipeRepository,
    },
};

pub fn execute(
    repo: &dyn RecipeRepository,
    id: &str,
    payload: RecipeUpdatePayload,
) -> Result<RecipeCatalogItem, RepoError> {
    repo.update_recipe(id, payload)
}
