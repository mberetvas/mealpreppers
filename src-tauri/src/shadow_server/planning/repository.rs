//! SQLite repository for the Planning slice: Saved Weekplans and month-plans.
//!
//! All functions take a `&Connection` (reads) or `&mut Connection` (writes) and return
//! `Result<T, RepoError>`. Handlers in `handlers.rs` open a connection per request inside
//! `tokio::task::spawn_blocking`.
//!
//! # Principal scoping
//!
//! Saved Weekplans are scoped to the install-level **Planning Principal** (`owner_user_id`).
//! Month-plans are not principal-scoped (they are install-global like the TypeScript API).

use rusqlite::{params, Connection};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::shadow_server::platform::RepoError;

use super::models::{
    DayMeals, MonthPlanListItem, MonthPlanRow, MonthPlanV1, RecipeIdSlot, SavedWeekplanListItem,
    SavedWeekplanRow, WeekPlanV1,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Opens a connection with FK enforcement.
pub fn open_conn(path: &std::path::Path) -> Result<Connection, RepoError> {
    let conn = Connection::open(path).map_err(|e| RepoError::Storage(format!("open db: {e}")))?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| RepoError::Storage(format!("set fk pragma: {e}")))?;
    Ok(conn)
}

fn now_iso() -> String {
    chrono::Utc::now()
        .format("%Y-%m-%dT%H:%M:%S%.3fZ")
        .to_string()
}

// ---------------------------------------------------------------------------
// Shopping list flags
// ---------------------------------------------------------------------------

/// Computes the canonical source fingerprint for a `WeekPlanV1` body.
///
/// Mirrors `computeSourceFingerprint` in `sourceFingerprint.ts`:
/// iterates days 1–7 × breakfast/lunch/dinner in fixed order, builds
/// `"d.meal=recipeId|..."`, then SHA-256 hex-encodes.
pub fn compute_source_fingerprint(body: &WeekPlanV1) -> String {
    let mut parts: Vec<String> = Vec::with_capacity(21);
    for day in ["1", "2", "3", "4", "5", "6", "7"] {
        let empty = DayMeals {
            breakfast: RecipeIdSlot { recipe_id: None },
            lunch: RecipeIdSlot { recipe_id: None },
            dinner: RecipeIdSlot { recipe_id: None },
        };
        let d = body.days.get(day).unwrap_or(&empty);
        for (meal, slot) in [
            ("breakfast", &d.breakfast),
            ("lunch", &d.lunch),
            ("dinner", &d.dinner),
        ] {
            parts.push(format!(
                "{day}.{meal}={}",
                slot.recipe_id.as_deref().unwrap_or("")
            ));
        }
    }
    let canonical = parts.join("|");
    let hash = Sha256::digest(canonical.as_bytes());
    hash.iter().fold(String::with_capacity(64), |mut s, b| {
        use std::fmt::Write;
        let _ = write!(s, "{b:02x}");
        s
    })
}

/// Computes `hasSavedShoppingList` and `shoppingListDeprecated` from the raw
/// `consolidated_shopping_list` JSON column value and the week plan body.
fn compute_shopping_list_flags(consolidated_json: Option<&str>, body: &WeekPlanV1) -> (bool, bool) {
    let Some(json_str) = consolidated_json else {
        return (false, false);
    };
    // Extract `sourceFingerprint` from the stored JSON record.
    let stored: serde_json::Value =
        serde_json::from_str(json_str).unwrap_or(serde_json::Value::Null);
    let stored_fp = stored["sourceFingerprint"].as_str().unwrap_or("");
    if stored_fp.is_empty() {
        return (false, false);
    }
    let current_fp = compute_source_fingerprint(body);
    let deprecated = stored_fp != current_fp;
    (true, deprecated)
}

// ---------------------------------------------------------------------------
// Recipe ID helpers
// ---------------------------------------------------------------------------

/// Collects non-empty recipe IDs referenced in a `WeekPlanV1`, deduplicated.
pub fn collect_recipe_ids_from_week_plan(plan: &WeekPlanV1) -> Vec<String> {
    let mut ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    for day in ["1", "2", "3", "4", "5", "6", "7"] {
        let Some(d) = plan.days.get(day) else {
            continue;
        };
        for slot in [&d.breakfast, &d.lunch, &d.dinner] {
            if let Some(ref id) = slot.recipe_id {
                if !id.is_empty() {
                    ids.insert(id.clone());
                }
            }
        }
    }
    ids.into_iter().collect()
}

/// Collects non-empty recipe IDs referenced in a `MonthPlanV1`, deduplicated.
pub fn collect_recipe_ids_from_month_plan(plan: &MonthPlanV1) -> Vec<String> {
    let mut ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    for week in plan.weeks.iter().flatten() {
        for id in collect_recipe_ids_from_week_plan(week) {
            ids.insert(id);
        }
    }
    ids.into_iter().collect()
}

/// Checks that all provided recipe IDs exist in the `recipes` table.
///
/// Returns `Err(RepoError::InvalidRecipeIds { missing })` when any ID is absent.
pub fn assert_recipe_ids_exist(conn: &Connection, recipe_ids: &[String]) -> Result<(), RepoError> {
    if recipe_ids.is_empty() {
        return Ok(());
    }

    let placeholders: String = recipe_ids
        .iter()
        .enumerate()
        .map(|(i, _)| format!("?{}", i + 1))
        .collect::<Vec<_>>()
        .join(",");
    let sql = format!("SELECT id FROM recipes WHERE id IN ({placeholders})");
    let mut stmt = conn.prepare(&sql).map_err(RepoError::from)?;
    let found: std::collections::HashSet<String> = stmt
        .query_map(rusqlite::params_from_iter(recipe_ids.iter()), |row| {
            row.get::<_, String>(0)
        })
        .map_err(RepoError::from)?
        .collect::<Result<_, _>>()
        .map_err(RepoError::from)?;

    let missing: Vec<String> = recipe_ids
        .iter()
        .filter(|id| !found.contains(*id))
        .cloned()
        .collect();

    if missing.is_empty() {
        Ok(())
    } else {
        Err(RepoError::InvalidRecipeIds { missing })
    }
}

// ---------------------------------------------------------------------------
// Saved Weekplans repository
// ---------------------------------------------------------------------------

/// Lists saved weekplans owned by `user_id`, ordered by `updated_at DESC`.
pub fn list_saved_weekplans(
    conn: &Connection,
    user_id: &str,
) -> Result<Vec<SavedWeekplanListItem>, RepoError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, body, updated_at, consolidated_shopping_list \
         FROM meal_week_templates \
         WHERE owner_user_id = ?1 \
         ORDER BY updated_at DESC",
    )?;

    let rows = stmt.query_map([user_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, Option<String>>(4)?,
        ))
    })?;

    let mut items = Vec::new();
    for row in rows {
        let (id, name, body_json, updated_at, csl) = row.map_err(RepoError::from)?;
        let body: WeekPlanV1 = serde_json::from_str(&body_json)?;
        let (has_saved, deprecated) = compute_shopping_list_flags(csl.as_deref(), &body);
        items.push(SavedWeekplanListItem {
            id,
            name,
            updated_at,
            has_saved_shopping_list: has_saved,
            shopping_list_deprecated: deprecated,
        });
    }
    Ok(items)
}

/// Returns a single saved weekplan by ID, scoped to `user_id`.
///
/// Returns `RepoError::NotFound` for unknown IDs or legacy unowned rows,
/// `RepoError::Forbidden` when the row belongs to a different user.
pub fn get_saved_weekplan_by_id(
    conn: &Connection,
    id: &str,
    user_id: &str,
) -> Result<SavedWeekplanRow, RepoError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, body, created_at, updated_at, owner_user_id, \
         consolidated_shopping_list \
         FROM meal_week_templates WHERE id = ?1",
    )?;

    let result = stmt.query_row([id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, Option<String>>(5)?,
            row.get::<_, Option<String>>(6)?,
        ))
    });

    match result {
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            return Err(RepoError::NotFound("Saved weekplan not found.".into()))
        }
        Err(e) => return Err(RepoError::from(e)),
        Ok(_) => {}
    }

    let (id_col, name, body_json, created_at, updated_at, owner_user_id, csl) = result.unwrap();

    // Legacy unowned rows (NULL owner_user_id) are treated as not-found.
    match owner_user_id.as_deref() {
        None => return Err(RepoError::NotFound("Saved weekplan not found.".into())),
        Some(owner) if owner != user_id => {
            return Err(RepoError::Forbidden(
                "You do not have access to this saved weekplan.".into(),
            ))
        }
        _ => {}
    }

    let body: WeekPlanV1 = serde_json::from_str(&body_json)?;
    let (has_saved, deprecated) = compute_shopping_list_flags(csl.as_deref(), &body);

    Ok(SavedWeekplanRow {
        id: id_col,
        name,
        body,
        created_at,
        updated_at,
        has_saved_shopping_list: has_saved,
        shopping_list_deprecated: deprecated,
    })
}

/// Creates a saved weekplan row owned by `user_id`.
pub fn create_saved_weekplan(
    conn: &mut Connection,
    user_id: &str,
    name: &str,
    body: &WeekPlanV1,
) -> Result<SavedWeekplanRow, RepoError> {
    let id = Uuid::new_v4().to_string();
    let ts = now_iso();
    let body_json = serde_json::to_string(body)?;

    conn.execute(
        "INSERT INTO meal_week_templates \
         (id, name, body, owner_user_id, anon_session_id, created_at, updated_at, \
          consolidated_shopping_list) \
         VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?5, NULL)",
        params![&id, name, &body_json, user_id, &ts],
    )
    .map_err(RepoError::from)?;

    get_saved_weekplan_by_id(conn, &id, user_id)
}

/// Updates name and/or body of a saved weekplan owned by `user_id`.
pub fn update_saved_weekplan(
    conn: &mut Connection,
    id: &str,
    user_id: &str,
    name: Option<&str>,
    body: Option<&WeekPlanV1>,
) -> Result<SavedWeekplanRow, RepoError> {
    // Verify existence and ownership first (reuse get to get consistent errors).
    get_saved_weekplan_by_id(conn, id, user_id)?;

    let ts = now_iso();
    match (name, body) {
        (Some(n), Some(b)) => {
            let body_json = serde_json::to_string(b)?;
            conn.execute(
                "UPDATE meal_week_templates SET name=?1, body=?2, updated_at=?3 \
                 WHERE id=?4 AND owner_user_id=?5",
                params![n, &body_json, &ts, id, user_id],
            )
            .map_err(RepoError::from)?;
        }
        (Some(n), None) => {
            conn.execute(
                "UPDATE meal_week_templates SET name=?1, updated_at=?2 \
                 WHERE id=?3 AND owner_user_id=?4",
                params![n, &ts, id, user_id],
            )
            .map_err(RepoError::from)?;
        }
        (None, Some(b)) => {
            let body_json = serde_json::to_string(b)?;
            conn.execute(
                "UPDATE meal_week_templates SET body=?1, updated_at=?2 \
                 WHERE id=?3 AND owner_user_id=?4",
                params![&body_json, &ts, id, user_id],
            )
            .map_err(RepoError::from)?;
        }
        (None, None) => {}
    }

    get_saved_weekplan_by_id(conn, id, user_id)
}

/// Deletes a saved weekplan owned by `user_id`.
pub fn delete_saved_weekplan(conn: &Connection, id: &str, user_id: &str) -> Result<(), RepoError> {
    // Verify ownership before attempting delete.
    get_saved_weekplan_by_id(conn, id, user_id)?;

    conn.execute(
        "DELETE FROM meal_week_templates WHERE id=?1 AND owner_user_id=?2",
        params![id, user_id],
    )
    .map_err(RepoError::from)?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Month Plans repository
// ---------------------------------------------------------------------------

/// Lists all month plans ordered by `updated_at DESC`.
pub fn list_month_plans(conn: &Connection) -> Result<Vec<MonthPlanListItem>, RepoError> {
    let mut stmt =
        conn.prepare("SELECT id, name, updated_at FROM meal_month_plans ORDER BY updated_at DESC")?;

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, Option<String>>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;

    rows.map(|r| {
        let (id, name, updated_at) = r.map_err(RepoError::from)?;
        Ok(MonthPlanListItem {
            id,
            name,
            updated_at,
        })
    })
    .collect()
}

/// Returns a single month plan by ID.
pub fn get_month_plan_by_id(conn: &Connection, id: &str) -> Result<MonthPlanRow, RepoError> {
    let result = conn.query_row(
        "SELECT id, name, body, created_at, updated_at \
         FROM meal_month_plans WHERE id = ?1",
        [id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        },
    );

    match result {
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            Err(RepoError::NotFound("Month plan not found.".into()))
        }
        Err(e) => Err(RepoError::from(e)),
        Ok((id_col, name, body_json, created_at, updated_at)) => {
            let body: MonthPlanV1 = serde_json::from_str(&body_json)?;
            Ok(MonthPlanRow {
                id: id_col,
                name,
                body,
                created_at,
                updated_at,
            })
        }
    }
}

/// Creates a month plan row.
pub fn create_month_plan(
    conn: &mut Connection,
    name: Option<&str>,
    body: &MonthPlanV1,
) -> Result<MonthPlanRow, RepoError> {
    let id = Uuid::new_v4().to_string();
    let ts = now_iso();
    let body_json = serde_json::to_string(body)?;

    conn.execute(
        "INSERT INTO meal_month_plans (id, name, body, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?4)",
        params![&id, name, &body_json, &ts],
    )
    .map_err(RepoError::from)?;

    get_month_plan_by_id(conn, &id)
}

/// Patches a month plan — updates name and/or body.
pub fn update_month_plan(
    conn: &mut Connection,
    id: &str,
    name: Option<Option<&str>>,
    body: Option<&MonthPlanV1>,
) -> Result<MonthPlanRow, RepoError> {
    // Verify existence first.
    get_month_plan_by_id(conn, id)?;

    let ts = now_iso();
    match (name, body) {
        (Some(n), Some(b)) => {
            let body_json = serde_json::to_string(b)?;
            conn.execute(
                "UPDATE meal_month_plans SET name=?1, body=?2, updated_at=?3 WHERE id=?4",
                params![n, &body_json, &ts, id],
            )
            .map_err(RepoError::from)?;
        }
        (Some(n), None) => {
            conn.execute(
                "UPDATE meal_month_plans SET name=?1, updated_at=?2 WHERE id=?3",
                params![n, &ts, id],
            )
            .map_err(RepoError::from)?;
        }
        (None, Some(b)) => {
            let body_json = serde_json::to_string(b)?;
            conn.execute(
                "UPDATE meal_month_plans SET body=?1, updated_at=?2 WHERE id=?3",
                params![&body_json, &ts, id],
            )
            .map_err(RepoError::from)?;
        }
        (None, None) => {}
    }

    get_month_plan_by_id(conn, id)
}

/// Deletes a month plan by ID.
pub fn delete_month_plan(conn: &Connection, id: &str) -> Result<(), RepoError> {
    // Verify existence before delete so we can return a typed 404.
    get_month_plan_by_id(conn, id)?;

    conn.execute("DELETE FROM meal_month_plans WHERE id=?1", [id])
        .map_err(RepoError::from)?;

    Ok(())
}
