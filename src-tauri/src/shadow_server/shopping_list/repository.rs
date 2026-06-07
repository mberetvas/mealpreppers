//! SQLite repository for the consolidated shopping list feature.
//!
//! The consolidated shopping list is stored as JSON in the
//! `meal_week_templates.consolidated_shopping_list` column.
//!
//! All functions verify weekplan existence and principal ownership before
//! reading or writing the column.

use rusqlite::{params, Connection};

use crate::shadow_server::platform::RepoError;
use super::models::SavedConsolidatedShoppingListRecord;

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/// Returns the saved consolidated shopping list for a weekplan.
///
/// Returns `RepoError::NotFound` when:
/// - The weekplan row does not exist.
/// - The weekplan is not owned by `user_id`.
/// - The `consolidated_shopping_list` column is NULL.
pub fn get_consolidated_shopping_list(
    conn: &Connection,
    plan_id: &str,
    user_id: &str,
) -> Result<SavedConsolidatedShoppingListRecord, RepoError> {
    let result = conn.query_row(
        "SELECT owner_user_id, consolidated_shopping_list \
         FROM meal_week_templates WHERE id = ?1",
        params![plan_id],
        |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(1)?,
            ))
        },
    );

    match result {
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            return Err(RepoError::NotFound("Saved weekplan not found.".into()))
        }
        Err(e) => return Err(RepoError::from(e)),
        Ok(_) => {}
    }

    let (owner_user_id, csl_json) = result.unwrap();

    match owner_user_id.as_deref() {
        None => return Err(RepoError::NotFound("Saved weekplan not found.".into())),
        Some(owner) if owner != user_id => {
            return Err(RepoError::Forbidden(
                "You do not have access to this saved weekplan.".into(),
            ))
        }
        _ => {}
    }

    let json_str = csl_json.ok_or_else(|| {
        RepoError::NotFound("No saved shopping list found for this weekplan.".into())
    })?;

    let record: SavedConsolidatedShoppingListRecord =
        serde_json::from_str(&json_str).map_err(|e| {
            RepoError::Storage(format!("json decode consolidated_shopping_list: {e}"))
        })?;

    Ok(record)
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/// Saves (inserts or replaces) the consolidated shopping list for a weekplan.
///
/// Returns `RepoError::NotFound` / `RepoError::Forbidden` when the weekplan
/// does not exist or is not owned by `user_id`.
pub fn save_consolidated_shopping_list(
    conn: &mut Connection,
    plan_id: &str,
    user_id: &str,
    record: &SavedConsolidatedShoppingListRecord,
) -> Result<SavedConsolidatedShoppingListRecord, RepoError> {
    // Verify existence and ownership.
    let result = conn.query_row(
        "SELECT owner_user_id FROM meal_week_templates WHERE id = ?1",
        params![plan_id],
        |row| row.get::<_, Option<String>>(0),
    );

    match result {
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            return Err(RepoError::NotFound("Saved weekplan not found.".into()))
        }
        Err(e) => return Err(RepoError::from(e)),
        Ok(_) => {}
    }

    let owner_user_id = result.unwrap();

    match owner_user_id.as_deref() {
        None => return Err(RepoError::NotFound("Saved weekplan not found.".into())),
        Some(owner) if owner != user_id => {
            return Err(RepoError::Forbidden(
                "You do not have access to this saved weekplan.".into(),
            ))
        }
        _ => {}
    }

    let json_str = serde_json::to_string(record).map_err(|e| {
        RepoError::Storage(format!("json encode consolidated_shopping_list: {e}"))
    })?;

    conn.execute(
        "UPDATE meal_week_templates \
         SET consolidated_shopping_list = ?1, updated_at = datetime('now') \
         WHERE id = ?2",
        params![json_str, plan_id],
    )
    .map_err(RepoError::from)?;

    Ok(record.clone())
}
