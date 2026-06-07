//! Delete multiple recipes by id.

use crate::shadow_server::{platform::RepoError, recipe_catalog::ports::RecipeRepository};

pub fn execute(repo: &dyn RecipeRepository, ids: &[String]) -> Result<usize, RepoError> {
    repo.delete_recipes_by_ids(ids)
}
