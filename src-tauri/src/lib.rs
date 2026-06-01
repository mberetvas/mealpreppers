mod diagnostics;
mod keychain;
mod sidecar;
mod startup;
pub mod shadow_server;

pub use diagnostics::{maybe_attach_console, pause_on_fatal_error};

use keychain::{
  clear_openrouter_key, get_app_version, get_data_dir, get_openrouter_key, has_openrouter_key,
  open_data_folder, open_external_url, set_openrouter_key,
};
use sidecar::{should_run_sidecar, SidecarState};
use shadow_server::ShadowServerState;
use startup::StartupTiming;
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
        // ShadowServerState drop triggers graceful Axum shutdown automatically.
      }
    });
}

fn close_main(app: &tauri::App) {
  if let Some(main) = app.get_webview_window("main") {
    let _ = main.close();
  }
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

  // Start the Desktop Local API shadow server in-process (platform milestone).
  // Runs on a separate loopback port; Nitro remains the user-facing API for this phase.
  let data_dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("resolve data dir: {e}"))?;
  std::fs::create_dir_all(&data_dir).map_err(|e| format!("create data dir: {e}"))?;

  let shadow_token = std::env::var("DESKTOP_TOKEN").ok();
  match shadow_server::start(&data_dir, shadow_token.as_deref(), &mut timing) {
    Ok(shadow_state) => {
      log::info!(
        "Desktop Local API shadow server running on 127.0.0.1:{}",
        shadow_state.port
      );
      app.manage(shadow_state);
    }
    Err(e) => {
      // Non-fatal in phase 1: the shadow server failing does not block the main window.
      diagnostics::eprintln(&format!("Shadow server failed to start: {e}"));
      log::warn!("desktop.shadow_server.start_failed error={e}");
    }
  }

  let setup_result = setup_main_window(app, &mut timing);

  if setup_result.is_err() {
    close_main(app);
    return setup_result;
  }

  timing.log_summary();
  Ok(())
}

fn setup_main_window(
  app: &mut tauri::App,
  timing: &mut StartupTiming,
) -> Result<(), Box<dyn std::error::Error>> {
  if should_run_sidecar() {
    let launch = sidecar::prepare_sidecar_launch(app.handle())?;
    let bootstrap = sidecar::bootstrap_script(launch.port, &launch.token);
    let blank = tauri::Url::parse("about:blank")?;

    WebviewWindowBuilder::new(app.handle(), "main", WebviewUrl::External(blank))
      .title("Mealprepper")
      .inner_size(1280.0, 800.0)
      .center()
      .initialization_script(&bootstrap)
      .build()?;
    timing.mark_main_window_created();
    timing.mark_main_window_shown();

    let state = match sidecar::finish_sidecar_launch(app.handle(), launch, timing) {
      Ok(state) => state,
      Err(e) => {
        close_main(app);
        return Err(e.into());
      }
    };

    let api_url = tauri::Url::parse(&format!("{}/", state.api_base()))?;
    let main = app
      .get_webview_window("main")
      .ok_or("Main window missing after sidecar setup")?;
    if let Err(e) = main.navigate(api_url) {
      if diagnostics::enabled() {
        diagnostics::eprintln(&format!("Failed to navigate main window to API: {e}"));
      }
      close_main(app);
      return Err(e.into());
    }
    timing.mark_main_navigated();

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
