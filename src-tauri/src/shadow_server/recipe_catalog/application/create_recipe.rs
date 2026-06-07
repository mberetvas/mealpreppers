//! Create a recipe in the catalog.

use crate::shadow_server::{
    platform::RepoError,
    recipe_catalog::{models::RecipeCatalogItem, models::RecipeCreatePayload, ports::RecipeRepository},
};

pub fn execute(
    repo: &dyn RecipeRepository,
    payload: RecipeCreatePayload,
) -> Result<RecipeCatalogItem, RepoError> {
    repo.create_recipe(payload)
}
