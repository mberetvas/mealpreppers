//! SQLite implementation of [`ConsolidatedShoppingListRepository`].

use std::path::PathBuf;

use crate::shadow_server::{
    planning::repository::open_conn,
    platform::RepoError,
    shopping_list::{
        models::SavedConsolidatedShoppingListRecord,
        ports::ConsolidatedShoppingListRepository,
        repository::{get_consolidated_shopping_list, save_consolidated_shopping_list},
    },
};

/// Install-scoped SQLite adapter for consolidated shopping list persistence.
pub struct SqliteConsolidatedShoppingListRepository {
    db_path: PathBuf,
}

impl SqliteConsolidatedShoppingListRepository {
    pub fn new(db_path: PathBuf) -> Self {
        Self { db_path }
    }
}

impl ConsolidatedShoppingListRepository for SqliteConsolidatedShoppingListRepository {
    fn get(
        &self,
        plan_id: &str,
        user_id: &str,
    ) -> Result<SavedConsolidatedShoppingListRecord, RepoError> {
        let conn = open_conn(&self.db_path)?;
        get_consolidated_shopping_list(&conn, plan_id, user_id)
    }

    fn save(
        &self,
        plan_id: &str,
        user_id: &str,
        record: &SavedConsolidatedShoppingListRecord,
    ) -> Result<SavedConsolidatedShoppingListRecord, RepoError> {
        let mut conn = open_conn(&self.db_path)?;
        save_consolidated_shopping_list(&mut conn, plan_id, user_id, record)
    }
}
