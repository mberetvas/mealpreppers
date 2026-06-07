//! Get a single recipe by id.

use crate::shadow_server::{
    platform::RepoError,
    recipe_catalog::{models::RecipeCatalogItem, ports::RecipeRepository},
};

pub fn execute(repo: &dyn RecipeRepository, id: &str) -> Result<RecipeCatalogItem, RepoError> {
    repo.get_recipe_by_id(id)
}
