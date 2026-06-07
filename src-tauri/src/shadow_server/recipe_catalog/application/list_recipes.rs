//! List all recipes in the catalog.

use crate::shadow_server::{
    platform::RepoError,
    recipe_catalog::{models::RecipeCatalogItem, ports::RecipeRepository},
};

pub fn execute(repo: &dyn RecipeRepository) -> Result<Vec<RecipeCatalogItem>, RepoError> {
    repo.list_recipes()
}
