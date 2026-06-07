//! Save a confirmed consolidated shopping list for a weekplan.

use crate::shadow_server::{
    planning::{ports::SavedWeekplanReader, repository::compute_source_fingerprint},
    platform::RepoError,
    shopping_list::{
        models::{SavedConsolidatedShoppingListRecord, SavedShoppingListLine},
        ports::ConsolidatedShoppingListRepository,
    },
};

const DEPRECATED_LIST_MESSAGE: &str =
    "The shopping list is outdated because the plan has changed. Please re-consolidate before saving.";

fn now_iso() -> String {
    chrono::Utc::now()
        .format("%Y-%m-%dT%H:%M:%S%.3fZ")
        .to_string()
}

pub fn execute(
    reader: &dyn SavedWeekplanReader,
    repo: &dyn ConsolidatedShoppingListRepository,
    plan_id: &str,
    user_id: &str,
    lines: Vec<SavedShoppingListLine>,
) -> Result<SavedConsolidatedShoppingListRecord, RepoError> {
    let context = reader.get_for_consolidated_list_ops(plan_id, user_id)?;
    let current_fingerprint = compute_source_fingerprint(&context.body);

    if let Some(existing) = &context.existing_list {
        if existing.source_fingerprint != current_fingerprint {
            return Err(RepoError::DeprecatedList(DEPRECATED_LIST_MESSAGE.into()));
        }
    }

    let record = SavedConsolidatedShoppingListRecord {
        lines,
        source_fingerprint: current_fingerprint,
        confirmed_at: now_iso(),
    };

    repo.save(plan_id, user_id, &record)
}
