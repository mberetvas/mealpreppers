//! SQLite implementation of [`SavedWeekplanReader`].

use std::path::PathBuf;

use rusqlite::params;

use crate::shadow_server::{
    planning::{
        models::WeekPlanV1,
        ports::{SavedWeekplanConsolidatedContext, SavedWeekplanReader},
        repository::open_conn,
    },
    platform::RepoError,
};

/// Install-scoped SQLite adapter for Saved Weekplan reads used by shopping list writes.
pub struct SqliteSavedWeekplanReader {
    db_path: PathBuf,
}

impl SqliteSavedWeekplanReader {
    pub fn new(db_path: PathBuf) -> Self {
        Self { db_path }
    }
}

impl SavedWeekplanReader for SqliteSavedWeekplanReader {
    fn get_for_consolidated_list_ops(
        &self,
        plan_id: &str,
        user_id: &str,
    ) -> Result<SavedWeekplanConsolidatedContext, RepoError> {
        let conn = open_conn(&self.db_path)?;

        let result = conn.query_row(
            "SELECT owner_user_id, body, consolidated_shopping_list \
             FROM meal_week_templates WHERE id = ?1",
            params![plan_id],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
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

        let (owner_user_id, body_json, csl_json) = result.unwrap();

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
        let existing_list = match csl_json {
            Some(json_str) => Some(serde_json::from_str(&json_str)?),
            None => None,
        };

        Ok(SavedWeekplanConsolidatedContext {
            body,
            existing_list,
        })
    }
}
