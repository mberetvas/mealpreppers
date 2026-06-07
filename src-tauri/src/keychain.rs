use keyring::Entry;
use tauri::{AppHandle, Manager};

const SERVICE: &str = "com.mealprepper.app";
const OPENROUTER_KEY_USER: &str = "openrouter-api-key";

fn openrouter_entry() -> Result<Entry, String> {
    Entry::new(SERVICE, OPENROUTER_KEY_USER).map_err(|e| e.to_string())
}

/// Masks a stored OpenRouter key for display (prefix + suffix only).
pub fn openrouter_key_hint(key: &str) -> String {
    let trimmed = key.trim();
    let chars: Vec<char> = trimmed.chars().collect();
    if chars.is_empty() {
        return String::new();
    }
    if chars.len() <= 12 {
        return "••••••••".to_string();
    }
    let visible_prefix: String = chars.iter().take(7).collect();
    let visible_suffix: String = chars.iter().skip(chars.len() - 4).collect();
    format!("{visible_prefix}••••{visible_suffix}")
}

/// Reads the OpenRouter API key from the OS keychain, if configured.
pub fn read_openrouter_key() -> Option<String> {
    let entry = openrouter_entry().ok()?;
    match entry.get_password() {
        Ok(key) if !key.trim().is_empty() => Some(key),
        _ => None,
    }
}

#[tauri::command]
pub fn get_openrouter_key() -> Result<Option<String>, String> {
    Ok(read_openrouter_key())
}

#[tauri::command]
pub fn set_openrouter_key(key: String) -> Result<(), String> {
    let trimmed = key.trim();
    if trimmed.is_empty() {
        return Err("OpenRouter API key cannot be empty.".to_string());
    }
    openrouter_entry()?
        .set_password(trimmed)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_openrouter_key() -> Result<(), String> {
    match openrouter_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn has_openrouter_key() -> bool {
    read_openrouter_key().is_some()
}

#[tauri::command]
pub fn get_openrouter_key_hint() -> Result<Option<String>, String> {
    Ok(read_openrouter_key()
        .map(|key| openrouter_key_hint(&key))
        .filter(|hint| !hint.is_empty()))
}

#[tauri::command]
pub fn get_app_version(app: AppHandle) -> Result<String, String> {
    Ok(app.package_info().version.to_string())
}

#[tauri::command]
pub fn get_data_dir(app: AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_data_folder(app: AppHandle) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    open::that(&data_dir).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::{clear_openrouter_key, has_openrouter_key, openrouter_key_hint, read_openrouter_key, set_openrouter_key};

    #[test]
    fn openrouter_key_roundtrip_persists_in_os_store() {
        let _ = clear_openrouter_key();
        let test_key = "sk-or-v1-debug-roundtrip-key-0001";
        set_openrouter_key(test_key.to_string()).expect("set_openrouter_key");
        let read_back = read_openrouter_key();
        let _ = clear_openrouter_key();
        assert_eq!(
            read_back.as_deref(),
            Some(test_key),
            "key must round-trip through the OS credential store"
        );
        assert!(!has_openrouter_key());
    }

    #[test]
    fn openrouter_key_hint_masks_middle_of_typical_key() {
        let hint = openrouter_key_hint("sk-or-v1-abcdef1234567890");
        assert_eq!(hint, "sk-or-v••••7890");
    }

    #[test]
    fn openrouter_key_hint_returns_dots_for_short_values() {
        assert_eq!(openrouter_key_hint("sk-or-abc"), "••••••••");
    }

    #[test]
    fn openrouter_key_hint_trims_whitespace() {
        let hint = openrouter_key_hint("  sk-or-v1-abcdef1234567890  ");
        assert_eq!(hint, "sk-or-v••••7890");
    }
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|e| e.to_string())?;
    if parsed.scheme() != "https" {
        return Err("Only https URLs may be opened externally.".to_string());
    }
    open::that(parsed.as_str()).map_err(|e| e.to_string())
}
