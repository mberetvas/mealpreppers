//! SQLite repository for install-scoped settings (`install_settings` singleton row).

use rusqlite::{params, Connection};

use crate::shadow_server::platform::RepoError;

pub const DEFAULT_OPENROUTER_SHOPPING_LIST_MODEL: &str = "deepseek/deepseek-v4-flash";

const SINGLETON_ID: i64 = 1;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstallSettings {
    pub openrouter_shopping_list_model: String,
}

impl Default for InstallSettings {
    fn default() -> Self {
        Self {
            openrouter_shopping_list_model: DEFAULT_OPENROUTER_SHOPPING_LIST_MODEL.to_string(),
        }
    }
}

/// Reads install settings from the singleton row, falling back to defaults when missing.
pub fn get_install_settings(conn: &Connection) -> Result<InstallSettings, RepoError> {
    let model: Option<String> = conn
        .query_row(
            "SELECT openrouter_shopping_list_model FROM install_settings WHERE id = ?1",
            params![SINGLETON_ID],
            |row| row.get(0),
        )
        .ok();

    Ok(InstallSettings {
        openrouter_shopping_list_model: model
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_OPENROUTER_SHOPPING_LIST_MODEL.to_string()),
    })
}

/// Updates the OpenRouter shopping-list polish model on the singleton row.
pub fn update_shopping_list_model(
    conn: &mut Connection,
    model: &str,
) -> Result<InstallSettings, RepoError> {
    conn.execute(
        "INSERT INTO install_settings (id, openrouter_shopping_list_model)
         VALUES (?1, ?2)
         ON CONFLICT(id) DO UPDATE SET openrouter_shopping_list_model = excluded.openrouter_shopping_list_model",
        params![SINGLETON_ID, model],
    )
    .map_err(|e| RepoError::Storage(format!("update install settings: {e}")))?;

    get_install_settings(conn)
}

/// Resolves the shopping-list polish model: DB row → env var → canonical default.
pub fn resolve_shopping_list_model(conn: &Connection) -> String {
    get_install_settings(conn)
        .map(|settings| settings.openrouter_shopping_list_model)
        .unwrap_or_else(|_| resolve_shopping_list_model_from_env())
}

pub fn resolve_shopping_list_model_from_env() -> String {
    std::env::var("OPENROUTER_SHOPPING_LIST_MODEL")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_OPENROUTER_SHOPPING_LIST_MODEL.to_string())
}

fn is_slug_char(c: char, allow_colon: bool) -> bool {
    c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-' || (allow_colon && c == ':')
}

fn is_valid_openrouter_model_slug(model: &str) -> bool {
    let Some((provider, slash_model)) = model.split_once('/') else {
        return false;
    };
    if provider.is_empty() || slash_model.is_empty() {
        return false;
    }
    let mut provider_chars = provider.chars();
    let Some(first_provider) = provider_chars.next() else {
        return false;
    };
    if !first_provider.is_ascii_alphanumeric() {
        return false;
    }
    if !provider_chars.all(|c| is_slug_char(c, false)) {
        return false;
    }

    let mut model_chars = slash_model.chars();
    let Some(first_model) = model_chars.next() else {
        return false;
    };
    if !first_model.is_ascii_alphanumeric() {
        return false;
    }
    model_chars.all(|c| is_slug_char(c, true))
}

/// Validates an OpenRouter model id (`provider/model` slug).
pub fn validate_shopping_list_model(model: &str) -> Result<(), String> {
    let trimmed = model.trim();
    if trimmed.is_empty() {
        return Err("OpenRouter model id is required.".into());
    }
    if trimmed.len() > 128 {
        return Err("OpenRouter model id must be at most 128 characters.".into());
    }
    if !is_valid_openrouter_model_slug(trimmed) {
        return Err(
            "OpenRouter model id must look like provider/model (letters, numbers, dots, dashes, underscores, colons)."
                .into(),
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shadow_server::planning::repository::open_conn;

    #[test]
    fn get_install_settings_returns_default_on_empty_db() {
        let temp = tempfile::TempDir::new().expect("tempdir");
        let db_path = temp.path().join("settings.db");
        crate::shadow_server::db::open_and_migrate(&db_path).expect("migrate");

        let conn = open_conn(&db_path).expect("open");
        let settings = get_install_settings(&conn).expect("read");
        assert_eq!(
            settings.openrouter_shopping_list_model,
            DEFAULT_OPENROUTER_SHOPPING_LIST_MODEL
        );
    }

    #[test]
    fn update_shopping_list_model_persists_value() {
        let temp = tempfile::TempDir::new().expect("tempdir");
        let db_path = temp.path().join("settings.db");
        crate::shadow_server::db::open_and_migrate(&db_path).expect("migrate");

        let mut conn = open_conn(&db_path).expect("open");
        let updated =
            update_shopping_list_model(&mut conn, "anthropic/claude-3.5-sonnet").expect("update");
        assert_eq!(
            updated.openrouter_shopping_list_model,
            "anthropic/claude-3.5-sonnet"
        );

        let reread = get_install_settings(&conn).expect("reread");
        assert_eq!(
            reread.openrouter_shopping_list_model,
            "anthropic/claude-3.5-sonnet"
        );
    }

    #[test]
    fn validate_shopping_list_model_rejects_invalid_slug() {
        assert!(validate_shopping_list_model("").is_err());
        assert!(validate_shopping_list_model("no-slash").is_err());
        assert!(validate_shopping_list_model(&"a/".repeat(70)).is_err());
        assert!(validate_shopping_list_model("deepseek/deepseek-v4-flash").is_ok());
    }
}
