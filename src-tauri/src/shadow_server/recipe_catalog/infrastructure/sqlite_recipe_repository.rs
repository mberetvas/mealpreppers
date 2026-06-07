//! SQLite implementation of [`RecipeRepository`].

use std::path::PathBuf;

use crate::shadow_server::{
    platform::RepoError,
    recipe_catalog::{
        models::{RecipeCatalogItem, RecipeCreatePayload, RecipeUpdatePayload},
        ports::RecipeRepository,
        repository::{
            create_recipe, delete_recipes_by_ids, get_recipe_by_id, list_recipes,
            list_stored_options, open_conn, update_recipe,
        },
    },
};

/// Install-scoped SQLite adapter for recipe catalog persistence.
pub struct SqliteRecipeRepository {
    db_path: PathBuf,
}

impl SqliteRecipeRepository {
    pub fn new(db_path: PathBuf) -> Self {
        Self { db_path }
    }
}

impl RecipeRepository for SqliteRecipeRepository {
    fn list_recipes(&self) -> Result<Vec<RecipeCatalogItem>, RepoError> {
        let conn = open_conn(&self.db_path)?;
        list_recipes(&conn)
    }

    fn get_recipe_by_id(&self, id: &str) -> Result<RecipeCatalogItem, RepoError> {
        let conn = open_conn(&self.db_path)?;
        get_recipe_by_id(&conn, id)
    }

    fn list_stored_options(&self) -> Result<(Vec<String>, Vec<String>), RepoError> {
        let conn = open_conn(&self.db_path)?;
        list_stored_options(&conn)
    }

    fn create_recipe(&self, payload: RecipeCreatePayload) -> Result<RecipeCatalogItem, RepoError> {
        let mut conn = open_conn(&self.db_path)?;
        create_recipe(&mut conn, payload)
    }

    fn update_recipe(
        &self,
        id: &str,
        payload: RecipeUpdatePayload,
    ) -> Result<RecipeCatalogItem, RepoError> {
        let mut conn = open_conn(&self.db_path)?;
        update_recipe(&mut conn, id, payload)
    }

    fn delete_recipes_by_ids(&self, ids: &[String]) -> Result<usize, RepoError> {
        let conn = open_conn(&self.db_path)?;
        delete_recipes_by_ids(&conn, ids)
    }
}
