//! Read port for Saved Weekplan ownership and body (used by consolidated list writes).

use crate::shadow_server::{
    planning::models::WeekPlanV1,
    platform::RepoError,
    shopping_list::models::SavedConsolidatedShoppingListRecord,
};

/// Weekplan context required to save a consolidated shopping list.
pub struct SavedWeekplanConsolidatedContext {
    pub body: WeekPlanV1,
    pub existing_list: Option<SavedConsolidatedShoppingListRecord>,
}

/// Planning read port for consolidated shopping list operations.
pub trait SavedWeekplanReader: Send + Sync {
    /// Loads weekplan body and any existing consolidated list after principal scoping.
    fn get_for_consolidated_list_ops(
        &self,
        plan_id: &str,
        user_id: &str,
    ) -> Result<SavedWeekplanConsolidatedContext, RepoError>;
}
