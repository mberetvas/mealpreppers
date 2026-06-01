mod diagnostics;
mod keychain;
mod sidecar;
mod startup;

pub use diagnostics::{maybe_attach_console, pause_on_fatal_error};

use keychain::{
  clear_openrouter_key, get_app_version, get_data_dir, get_openrouter_key, has_openrouter_key,
  open_data_folder, open_external_url, set_openrouter_key,
};
use sidecar::{should_run_sidecar, SidecarState};
use startup::{StartupTiming, uses_splash_screen};
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

fn close_splash(app: &tauri::App) {
  if let Some(splash) = app.get_webview_window("splash") {
    let _ = splash.close();
  }
}

fn open_splash(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
  WebviewWindowBuilder::new(app.handle(), "splash", WebviewUrl::App("splash.html".into()))
    .title("Mealprepper")
    .inner_size(360.0, 280.0)
    .center()
    .resizable(false)
    .always_on_top(true)
    .build()?;
  Ok(())
}

fn setup_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
  if diagnostics::enabled() || startup::timing_enabled() {
    app.handle().plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build(),
    )?;
  }

  let mut timing = StartupTiming::begin();
  let show_splash = uses_splash_screen();

  if show_splash {
    open_splash(app)?;
  }

  let setup_result = setup_main_window(app, &mut timing);

  if setup_result.is_err() {
    close_splash(app);
    return setup_result;
  }

  close_splash(app);
  timing.log_summary();
  Ok(())
}

fn setup_main_window(
  app: &mut tauri::App,
  timing: &mut StartupTiming,
) -> Result<(), Box<dyn std::error::Error>> {
  if should_run_sidecar() {
    let state = sidecar::start_sidecar(app.handle(), timing)?;
    let bootstrap = state.bootstrap_script();
    let url = tauri::Url::parse(&format!("{}/", state.api_base()))?;

    WebviewWindowBuilder::new(app.handle(), "main", WebviewUrl::External(url))
      .title("Mealprepper")
      .inner_size(1280.0, 800.0)
      .center()
      .visible(false)
      .initialization_script(&bootstrap)
      .build()?;
    timing.mark_main_window_created();

    if let Some(window) = app.get_webview_window("main") {
      window.show().map_err(|e| e.to_string())?;
      timing.mark_main_window_shown();
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
