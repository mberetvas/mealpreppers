//! Load the saved consolidated shopping list for a weekplan.

use crate::shadow_server::{
    platform::RepoError,
    shopping_list::{
        models::SavedConsolidatedShoppingListRecord,
        ports::ConsolidatedShoppingListRepository,
    },
};

pub fn execute(
    repo: &dyn ConsolidatedShoppingListRepository,
    plan_id: &str,
    user_id: &str,
) -> Result<SavedConsolidatedShoppingListRecord, RepoError> {
    repo.get(plan_id, user_id)
}
