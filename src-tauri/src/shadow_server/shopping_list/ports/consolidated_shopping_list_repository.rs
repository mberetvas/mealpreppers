//! Persistence port for the saved consolidated shopping list column.

use crate::shadow_server::{
    platform::RepoError,
    shopping_list::models::SavedConsolidatedShoppingListRecord,
};

/// Persistence port for the **Saved Consolidated Shopping List** JSON column.
pub trait ConsolidatedShoppingListRepository: Send + Sync {
    /// Returns the saved list for a weekplan owned by `user_id`.
    fn get(
        &self,
        plan_id: &str,
        user_id: &str,
    ) -> Result<SavedConsolidatedShoppingListRecord, RepoError>;

    /// Creates or replaces the saved list for a weekplan owned by `user_id`.
    fn save(
        &self,
        plan_id: &str,
        user_id: &str,
        record: &SavedConsolidatedShoppingListRecord,
    ) -> Result<SavedConsolidatedShoppingListRecord, RepoError>;
}
