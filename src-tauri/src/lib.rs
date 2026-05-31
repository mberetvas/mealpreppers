mod sidecar;

use sidecar::{should_run_sidecar, SidecarState};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      if should_run_sidecar() {
        let state = sidecar::start_sidecar(app.handle())?;
        let bootstrap = state.bootstrap_script();
        let url = tauri::Url::parse(&format!("{}/", state.api_base()))
          .map_err(|e| -> Box<dyn std::error::Error> { Box::new(e) })?;

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
      }
      else if let Some(dev_url) = app.config().build.dev_url.clone() {
        WebviewWindowBuilder::new(app.handle(), "main", WebviewUrl::External(dev_url))
        .title("Mealprepper")
        .inner_size(1280.0, 800.0)
        .center()
        .build()?;
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while running tauri application")
    .run(|app, event| {
      if matches!(event, RunEvent::Exit) {
        if let Some(state) = app.try_state::<SidecarState>() {
          state.stop();
        }
      }
    });
}
