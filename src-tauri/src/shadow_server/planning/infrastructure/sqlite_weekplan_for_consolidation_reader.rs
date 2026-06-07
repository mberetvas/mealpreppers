//! SQLite adapter for [`WeekplanForConsolidationReader`].

use std::path::PathBuf;

use crate::shadow_server::{
    planning::repository::{compute_source_fingerprint, get_saved_weekplan_by_id, open_conn},
    platform::RepoError,
    shopping_list::ports::{WeekplanForConsolidation, WeekplanForConsolidationReader},
};

/// Install-scoped SQLite adapter for weekplan reads used by consolidation POST.
pub struct SqliteWeekplanForConsolidationReader {
    db_path: PathBuf,
}

impl SqliteWeekplanForConsolidationReader {
    pub fn new(db_path: PathBuf) -> Self {
        Self { db_path }
    }
}

impl WeekplanForConsolidationReader for SqliteWeekplanForConsolidationReader {
    fn get_for_consolidation(
        &self,
        plan_id: &str,
        user_id: &str,
    ) -> Result<WeekplanForConsolidation, RepoError> {
        let conn = open_conn(&self.db_path)?;
        let row = get_saved_weekplan_by_id(&conn, plan_id, user_id)?;
        Ok(WeekplanForConsolidation {
            source_fingerprint: compute_source_fingerprint(&row.body),
            body: row.body,
        })
    }
}
