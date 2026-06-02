//! Unified repository error type shared by all vertical slices.

#[derive(Debug)]
pub enum RepoError {
    NotFound(String),
    Forbidden(String),
    InvalidRecipeIds { missing: Vec<String> },
    /// Saved consolidated list is stale because the week plan body changed.
    DeprecatedList(String),
    Storage(String),
}

impl From<rusqlite::Error> for RepoError {
    fn from(e: rusqlite::Error) -> Self {
        RepoError::Storage(e.to_string())
    }
}

impl From<serde_json::Error> for RepoError {
    fn from(e: serde_json::Error) -> Self {
        RepoError::Storage(format!("json: {e}"))
    }
}
