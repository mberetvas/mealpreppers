//! Recipe Catalog SQLite repository.
//!
//! All functions take a `&Connection` (reads) or `&mut Connection` (writes that need
//! transactions) and return `Result<T, RepoError>`.  The async handlers in
//! `handlers.rs` open a connection per request inside `tokio::task::spawn_blocking`.
//!
//! **categories / tags** are stored as JSON text arrays (matching Drizzle's `{ mode: 'json' }`
//! column type), e.g. `["Lunch","Italian"]`.

use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::shadow_server::platform::RepoError;

use super::models::*;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Returns the current UTC time in ISO 8601 format matching JavaScript's
/// `new Date().toISOString()` — e.g. `2024-01-15T10:30:00.000Z`.
fn now_iso() -> String {
    chrono::Utc::now()
        .format("%Y-%m-%dT%H:%M:%S%.3fZ")
        .to_string()
}

/// Opens a connection and enables `PRAGMA foreign_keys = ON`.
pub fn open_conn(path: &std::path::Path) -> Result<Connection, RepoError> {
    let conn = Connection::open(path)
        .map_err(|e| RepoError::Storage(format!("open db: {e}")))?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| RepoError::Storage(format!("set fk pragma: {e}")))?;
    Ok(conn)
}

fn serialize_json_list(values: &[String]) -> String {
    serde_json::to_string(values).unwrap_or_else(|_| "[]".to_string())
}

fn deserialize_json_list(s: &str) -> Vec<String> {
    serde_json::from_str(s).unwrap_or_default()
}

// ---------------------------------------------------------------------------
// Row → domain model
// ---------------------------------------------------------------------------

fn row_to_item(
    row: &rusqlite::Row<'_>,
    ingredients: Vec<RecipeIngredient>,
    steps: Vec<RecipeStep>,
) -> Result<RecipeCatalogItem, rusqlite::Error> {
    let categories_json: String = row.get("categories")?;
    let tags_json: String = row.get("tags")?;

    Ok(RecipeCatalogItem {
        id: row.get("id")?,
        title: row.get("title")?,
        description: row.get("description")?,
        source_url: row.get("source_url")?,
        source_host: row.get("source_host")?,
        image_url: row.get("image_url")?,
        servings: row.get("servings")?,
        prep_time_minutes: row.get("prep_time_minutes")?,
        cook_time_minutes: row.get("cook_time_minutes")?,
        total_time_minutes: row.get("total_time_minutes")?,
        difficulty: row.get("difficulty")?,
        categories: deserialize_json_list(&categories_json),
        tags: deserialize_json_list(&tags_json),
        ingredients,
        steps,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn load_ingredients(conn: &Connection, recipe_id: &str) -> Result<Vec<RecipeIngredient>, RepoError> {
    let mut stmt = conn.prepare(
        "SELECT id, position, raw_text, name, quantity, unit \
         FROM recipe_ingredients WHERE recipe_id = ?1 ORDER BY position",
    )?;
    let rows = stmt.query_map([recipe_id], |row| {
        Ok(RecipeIngredient {
            id: row.get(0)?,
            position: row.get(1)?,
            raw_text: row.get(2)?,
            name: row.get(3)?,
            quantity: row.get(4)?,
            unit: row.get(5)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(RepoError::from)
}

fn load_steps(conn: &Connection, recipe_id: &str) -> Result<Vec<RecipeStep>, RepoError> {
    let mut stmt = conn.prepare(
        "SELECT id, position, text \
         FROM recipe_steps WHERE recipe_id = ?1 ORDER BY position",
    )?;
    let rows = stmt.query_map([recipe_id], |row| {
        Ok(RecipeStep {
            id: row.get(0)?,
            position: row.get(1)?,
            text: row.get(2)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(RepoError::from)
}

// ---------------------------------------------------------------------------
// Public repository functions
// ---------------------------------------------------------------------------

/// Lists all recipes ordered by `created_at DESC` with their ingredients and steps.
pub fn list_recipes(conn: &Connection) -> Result<Vec<RecipeCatalogItem>, RepoError> {
    let mut stmt = conn.prepare(
        "SELECT id, title, description, source_url, source_host, image_url, \
         servings, prep_time_minutes, cook_time_minutes, total_time_minutes, \
         difficulty, categories, tags, created_at, updated_at \
         FROM recipes ORDER BY created_at DESC",
    )?;

    let recipe_ids_and_rows: Vec<(String, RecipeCatalogItem)> = {
        let mut items: Vec<(String, RecipeCatalogItem)> = Vec::new();
        let mut rows = stmt.query([])?;
        while let Some(row) = rows.next()? {
            let id: String = row.get("id")?;
            let item = row_to_item(row, vec![], vec![]).map_err(RepoError::from)?;
            items.push((id, item));
        }
        items
    };

    let mut result = Vec::with_capacity(recipe_ids_and_rows.len());
    for (id, mut item) in recipe_ids_and_rows {
        item.ingredients = load_ingredients(conn, &id)?;
        item.steps = load_steps(conn, &id)?;
        result.push(item);
    }

    Ok(result)
}

/// Returns a single recipe with ingredients and steps, or `RepoError::NotFound`.
pub fn get_recipe_by_id(conn: &Connection, id: &str) -> Result<RecipeCatalogItem, RepoError> {
    let mut stmt = conn.prepare(
        "SELECT id, title, description, source_url, source_host, image_url, \
         servings, prep_time_minutes, cook_time_minutes, total_time_minutes, \
         difficulty, categories, tags, created_at, updated_at \
         FROM recipes WHERE id = ?1",
    )?;

    let item = stmt
        .query_row([id], |row| row_to_item(row, vec![], vec![]))
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => RepoError::NotFound("Recipe not found.".into()),
            other => RepoError::Storage(other.to_string()),
        })?;

    let ingredients = load_ingredients(conn, &item.id)?;
    let steps = load_steps(conn, &item.id)?;

    Ok(RecipeCatalogItem {
        ingredients,
        steps,
        ..item
    })
}

/// Creates a recipe with its ingredients and steps inside a transaction.
///
/// Returns the full `RecipeCatalogItem` as persisted.
pub fn create_recipe(
    conn: &mut Connection,
    payload: RecipeCreatePayload,
) -> Result<RecipeCatalogItem, RepoError> {
    let recipe_id = Uuid::new_v4().to_string();
    let timestamp = now_iso();
    let categories_json = serialize_json_list(&payload.categories);
    let tags_json = serialize_json_list(&payload.tags);

    {
        let tx = conn.transaction().map_err(RepoError::from)?;

        tx.execute(
            "INSERT INTO recipes \
             (id, title, description, source_url, source_host, image_url, \
              servings, prep_time_minutes, cook_time_minutes, total_time_minutes, \
              difficulty, categories, tags, created_at, updated_at) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)",
            params![
                &recipe_id,
                &payload.title,
                &payload.description,
                &payload.source_url,
                &payload.source_host,
                &payload.image_url,
                payload.servings,
                payload.prep_time_minutes,
                payload.cook_time_minutes,
                payload.total_time_minutes,
                &payload.difficulty,
                &categories_json,
                &tags_json,
                &timestamp,
                &timestamp,
            ],
        )
        .map_err(RepoError::from)?;

        for (index, ingredient) in payload.ingredients.iter().enumerate() {
            let ingredient_id = Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO recipe_ingredients \
                 (id, recipe_id, position, raw_text, name, quantity, unit, created_at) \
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
                params![
                    &ingredient_id,
                    &recipe_id,
                    (index + 1) as i64,
                    &ingredient.raw_text,
                    &ingredient.name,
                    ingredient.quantity,
                    &ingredient.unit,
                    &timestamp,
                ],
            )
            .map_err(RepoError::from)?;
        }

        for (index, step) in payload.steps.iter().enumerate() {
            let step_id = Uuid::new_v4().to_string();
            let position = step.position.unwrap_or((index + 1) as i64);
            tx.execute(
                "INSERT INTO recipe_steps (id, recipe_id, position, text, created_at) \
                 VALUES (?1,?2,?3,?4,?5)",
                params![&step_id, &recipe_id, position, &step.text, &timestamp],
            )
            .map_err(RepoError::from)?;
        }

        tx.commit().map_err(RepoError::from)?;
    }

    get_recipe_by_id(conn, &recipe_id)
}

/// Replaces all fields, ingredients, and steps for the given recipe inside a transaction.
///
/// Returns `RepoError::NotFound` if the recipe does not exist.
pub fn update_recipe(
    conn: &mut Connection,
    id: &str,
    payload: RecipeUpdatePayload,
) -> Result<RecipeCatalogItem, RepoError> {
    // Check existence before starting the transaction
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM recipes WHERE id = ?1",
            [id],
            |row| row.get(0),
        )
        .map_err(RepoError::from)?;

    if !exists {
        return Err(RepoError::NotFound("Recipe not found.".into()));
    }

    let timestamp = now_iso();
    let categories_json = serialize_json_list(&payload.categories);
    let tags_json = serialize_json_list(&payload.tags);

    {
        let tx = conn.transaction().map_err(RepoError::from)?;

        tx.execute(
            "UPDATE recipes SET \
             title=?1, description=?2, source_url=?3, source_host=?4, image_url=?5, \
             servings=?6, prep_time_minutes=?7, cook_time_minutes=?8, \
             total_time_minutes=?9, difficulty=?10, categories=?11, tags=?12, \
             updated_at=?13 \
             WHERE id=?14",
            params![
                &payload.title,
                &payload.description,
                &payload.source_url,
                &payload.source_host,
                &payload.image_url,
                payload.servings,
                payload.prep_time_minutes,
                payload.cook_time_minutes,
                payload.total_time_minutes,
                &payload.difficulty,
                &categories_json,
                &tags_json,
                &timestamp,
                id,
            ],
        )
        .map_err(RepoError::from)?;

        tx.execute(
            "DELETE FROM recipe_ingredients WHERE recipe_id = ?1",
            [id],
        )
        .map_err(RepoError::from)?;

        tx.execute("DELETE FROM recipe_steps WHERE recipe_id = ?1", [id])
            .map_err(RepoError::from)?;

        for (index, ingredient) in payload.ingredients.iter().enumerate() {
            let ingredient_id = Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO recipe_ingredients \
                 (id, recipe_id, position, raw_text, name, quantity, unit, created_at) \
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
                params![
                    &ingredient_id,
                    id,
                    (index + 1) as i64,
                    &ingredient.raw_text,
                    &ingredient.name,
                    ingredient.quantity,
                    &ingredient.unit,
                    &timestamp,
                ],
            )
            .map_err(RepoError::from)?;
        }

        for (index, step) in payload.steps.iter().enumerate() {
            let step_id = Uuid::new_v4().to_string();
            let position = step.position.unwrap_or((index + 1) as i64);
            tx.execute(
                "INSERT INTO recipe_steps (id, recipe_id, position, text, created_at) \
                 VALUES (?1,?2,?3,?4,?5)",
                params![&step_id, id, position, &step.text, &timestamp],
            )
            .map_err(RepoError::from)?;
        }

        tx.commit().map_err(RepoError::from)?;
    }

    get_recipe_by_id(conn, id)
}

/// Deletes recipes by ID (de-duplicated). Returns the number of rows actually deleted.
///
/// IDs that do not exist are silently skipped (same behaviour as the TypeScript implementation).
pub fn delete_recipes_by_ids(
    conn: &Connection,
    ids: &[String],
) -> Result<usize, RepoError> {
    if ids.is_empty() {
        return Ok(0);
    }

    // Build parameterised IN clause; rusqlite doesn't support dynamic binding natively
    // so we build the SQL string. IDs are UUID strings so no injection risk.
    let placeholders: String = ids
        .iter()
        .enumerate()
        .map(|(i, _)| format!("?{}", i + 1))
        .collect::<Vec<_>>()
        .join(",");

    let sql = format!("DELETE FROM recipes WHERE id IN ({placeholders})");
    let count = conn
        .execute(
            &sql,
            rusqlite::params_from_iter(ids.iter()),
        )
        .map_err(RepoError::from)?;

    Ok(count)
}

/// Returns the distinct `categories` and `tags` that exist across all stored recipes.
pub fn list_stored_options(conn: &Connection) -> Result<(Vec<String>, Vec<String>), RepoError> {
    let mut stmt = conn.prepare("SELECT categories, tags FROM recipes")?;
    let mut categories: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut tags: std::collections::HashSet<String> = std::collections::HashSet::new();

    let rows = stmt.query_map([], |row| {
        let cats: String = row.get(0)?;
        let tgs: String = row.get(1)?;
        Ok((cats, tgs))
    })?;

    for row in rows {
        let (cats_json, tags_json) = row.map_err(RepoError::from)?;
        for c in deserialize_json_list(&cats_json) {
            categories.insert(c);
        }
        for t in deserialize_json_list(&tags_json) {
            tags.insert(t);
        }
    }

    Ok((
        categories.into_iter().collect(),
        tags.into_iter().collect(),
    ))
}
