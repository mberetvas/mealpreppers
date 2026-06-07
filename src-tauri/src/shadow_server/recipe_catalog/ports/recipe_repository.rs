//! Recipe Catalog persistence port (reads in Phase 1a; writes in Phase 1b).

use crate::shadow_server::{
    platform::RepoError,
    recipe_catalog::models::{RecipeCatalogItem, RecipeCreatePayload, RecipeUpdatePayload},
};

/// Persistence port for Recipe Catalog recipes.
pub trait RecipeRepository: Send + Sync {
    /// Lists all recipes ordered by creation date descending.
    fn list_recipes(&self) -> Result<Vec<RecipeCatalogItem>, RepoError>;

    /// Returns a single recipe by id, or [`RepoError::NotFound`].
    fn get_recipe_by_id(&self, id: &str) -> Result<RecipeCatalogItem, RepoError>;

    /// Returns distinct categories and tags stored across all recipes.
    fn list_stored_options(&self) -> Result<(Vec<String>, Vec<String>), RepoError>;

    /// Creates a recipe with ingredients and steps; returns the persisted item.
    fn create_recipe(
        &self,
        payload: RecipeCreatePayload,
    ) -> Result<RecipeCatalogItem, RepoError>;

    /// Replaces a recipe or returns [`RepoError::NotFound`].
    fn update_recipe(
        &self,
        id: &str,
        payload: RecipeUpdatePayload,
    ) -> Result<RecipeCatalogItem, RepoError>;

    /// Deletes recipes by id; returns the number of rows deleted.
    fn delete_recipes_by_ids(&self, ids: &[String]) -> Result<usize, RepoError>;
}
