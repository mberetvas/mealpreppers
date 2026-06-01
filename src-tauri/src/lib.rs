mod diagnostics;
mod keychain;
mod sidecar;

pub use diagnostics::{maybe_attach_console, pause_on_fatal_error};

use keychain::{
  clear_openrouter_key, get_app_version, get_data_dir, get_openrouter_key, has_openrouter_key,
  open_data_folder, open_external_url, set_openrouter_key,
};
use sidecar::{should_run_sidecar, SidecarState};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![
      get_openrouter_key,
      set_openrouter_key,
      clear_openrouter_key,
      has_openrouter_key,
      get_app_version,
      get_data_dir,
      open_data_folder,
      open_external_url,
    ])
    .setup(|app| match setup_app(app) {
      Ok(()) => Ok(()),
      Err(e) => {
        diagnostics::eprintln(&format!("Mealprepper setup failed: {e}"));
        pause_on_fatal_error();
        Err(e)
      }
    })
    .build(tauri::generate_context!())
    .unwrap_or_else(|e| {
      diagnostics::eprintln(&format!("Failed to build Tauri application: {e}"));
      pause_on_fatal_error();
      std::process::exit(1);
    })
    .run(|app, event| {
      if matches!(event, RunEvent::Exit) {
        if let Some(state) = app.try_state::<SidecarState>() {
          state.stop();
        }
      }
    });
}

fn setup_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
  if diagnostics::enabled() {
    app.handle().plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build(),
    )?;
  }

  if should_run_sidecar() {
    let state = sidecar::start_sidecar(app.handle())?;
    let bootstrap = state.bootstrap_script();
    let url = tauri::Url::parse(&format!("{}/", state.api_base()))?;

    WebviewWindowBuilder::new(app.handle(), "main", WebviewUrl::External(url))
      .title("Mealprepper")
      .inner_size(1280.0, 800.0)
      .center()
      .visible(false)
      .initialization_script(&bootstrap)
      .build()?;

    if let Some(window) = app.get_webview_window("main") {
      window.show().map_err(|e| e.to_string())?;
    }

    app.manage(state);
  } else if let Some(dev_url) = app.config().build.dev_url.clone() {
    WebviewWindowBuilder::new(app.handle(), "main", WebviewUrl::External(dev_url))
      .title("Mealprepper")
      .inner_size(1280.0, 800.0)
      .center()
      .build()?;
  }

  Ok(())
}
