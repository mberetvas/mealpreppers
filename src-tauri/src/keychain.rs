use keyring::Entry;
use tauri::{AppHandle, Manager};

const SERVICE: &str = "com.mealprepper.app";
const OPENROUTER_KEY_USER: &str = "openrouter-api-key";

fn openrouter_entry() -> Result<Entry, String> {
    Entry::new(SERVICE, OPENROUTER_KEY_USER).map_err(|e| e.to_string())
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

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|e| e.to_string())?;
    if parsed.scheme() != "https" {
        return Err("Only https URLs may be opened externally.".to_string());
    }
    open::that(parsed.as_str()).map_err(|e| e.to_string())
}
