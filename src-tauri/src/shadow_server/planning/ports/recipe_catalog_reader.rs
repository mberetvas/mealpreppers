//! Planning port for validating recipe ids against the Recipe Catalog (impl in Phase 2a).

use crate::shadow_server::platform::RepoError;

/// Read-only view of the Recipe Catalog used by Planning to validate recipe references.
pub trait RecipeCatalogReader: Send + Sync {
    /// Ensures every id exists in the catalog; returns [`RepoError::InvalidRecipeIds`] when not.
    fn assert_recipe_ids_exist(&self, recipe_ids: &[String]) -> Result<(), RepoError>;
}
