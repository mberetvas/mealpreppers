mod diagnostics;
mod keychain;
pub mod shadow_server;
mod sidecar;
mod startup;

pub use diagnostics::{maybe_attach_console, pause_on_fatal_error};

use keychain::{
    clear_openrouter_key, get_app_version, get_data_dir, get_openrouter_key,
    get_openrouter_key_hint, has_openrouter_key, open_data_folder, open_external_url,
    set_openrouter_key,
};
use sidecar::should_run_sidecar;
use startup::StartupTiming;
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use uuid::Uuid;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_openrouter_key,
            set_openrouter_key,
            clear_openrouter_key,
            has_openrouter_key,
            get_openrouter_key_hint,
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
        .run(|_app, event| {
            // ShadowServerState (Rust primary API) drop triggers graceful Axum shutdown automatically
            // when Tauri releases managed state on exit.
            if matches!(event, RunEvent::Exit) {
                // No explicit action required — shutdown_tx drop in ShadowServerState handles cleanup.
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
        // Desktop Local API (Rust/Axum) is the primary server.
        // No Node/Nitro child process is spawned.
        let data_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("resolve data dir: {e}"))?;
        std::fs::create_dir_all(&data_dir).map_err(|e| format!("create data dir: {e}"))?;

        let token = Uuid::new_v4().to_string();
        let rust_state = shadow_server::start(&data_dir, Some(&token))
            .map_err(|e| format!("Desktop Local API failed to start: {e}"))?;
        timing.mark_rust_api_spawned();

        log::info!("Desktop Local API running on 127.0.0.1:{}", rust_state.port);

        // Wait for the Rust API to be ready before opening the window so the
        // initialization script can immediately reach `/health` on first render.
        if let Err(e) = sidecar::wait_for_health(rust_state.port) {
            return Err(e.into());
        }
        timing.mark_rust_api_healthy();

        let bootstrap = sidecar::bootstrap_script(rust_state.port, &token);

        // Tauri serves the static frontend from `frontendDist` via the internal
        // tauri://localhost/ (or https://tauri.localhost/ on Windows) protocol.
        WebviewWindowBuilder::new(
            app.handle(),
            "main",
            WebviewUrl::App(std::path::PathBuf::from("index.html")),
        )
        .title("Mealprepper")
        .inner_size(1280.0, 800.0)
        .center()
        .initialization_script(&bootstrap)
        .build()?;
        timing.mark_main_window_created();
        timing.mark_main_window_shown();
        timing.mark_main_navigated();

        app.manage(rust_state);
    } else if let Some(dev_url) = app.config().build.dev_url.clone() {
        WebviewWindowBuilder::new(app.handle(), "main", WebviewUrl::External(dev_url))
            .title("Mealprepper")
            .inner_size(1280.0, 800.0)
            .center()
            .build()?;
    }

    Ok(())
}
