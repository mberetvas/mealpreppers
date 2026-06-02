//! Desktop Local API — the primary in-process Axum server for the Tauri desktop app.
//!
//! `start()` runs the in-process Axum server on a random `127.0.0.1` loopback port:
//! 1. Opens SQLite with WAL + FK and runs **Install database migrations**.
//! 2. Spawns a Tokio runtime on a background OS thread.
//! 3. Binds `127.0.0.1:0` and returns the assigned port + a shutdown handle.
//!
//! The returned `ShadowServerState` owns the shutdown sender; dropping it triggers
//! graceful shutdown of the Axum server.
//!
//! All user-facing `/api/v1` routes are served exclusively by this Rust server.
//! The Nuxt/Nitro sidecar is no longer used in the desktop product.

pub mod db;
pub mod error;
pub mod middleware;
pub mod platform;
pub mod planning;
pub mod recipe_catalog;
pub mod recipe_ingestion;
pub mod request_context;
pub mod routes;
pub mod shopping_list;
pub mod wire;

use std::path::{Path, PathBuf};
use std::sync::{mpsc, Arc};
use std::time::Duration;

/// Handle for the running shadow server. Dropping this stops the server gracefully.
pub struct ShadowServerState {
    /// Loopback port the shadow server is listening on.
    pub port: u16,
    /// Desktop token used to authenticate `/api/**` requests; `None` when unenforced.
    /// Stored here so Tauri startup can embed the same value in the WebView bootstrap script.
    pub token: Option<String>,
    /// Sending a value (or dropping) triggers Axum graceful shutdown.
    _shutdown_tx: tokio::sync::oneshot::Sender<()>,
}

impl ShadowServerState {
    /// Loopback origin for the Desktop Local API (e.g. `http://127.0.0.1:49152`).
    pub fn api_base(&self) -> String {
        format!("http://127.0.0.1:{}", self.port)
    }
}

/// Starts the in-process Desktop Local API shadow server.
///
/// - Opens and migrates the install database at `data_dir/mealprepper.db`
///   (or `$DATABASE_PATH` when set).
/// - Spawns a Tokio runtime on a background thread and starts the Axum listener.
///
/// Callers are responsible for recording startup timing milestones after this returns.
pub fn start(
    data_dir: &Path,
    token: Option<&str>,
) -> Result<ShadowServerState, String> {
    let db_path = resolve_db_path(data_dir);
    db::open_and_migrate(&db_path)?;

    let (port_tx, port_rx) = mpsc::channel::<Result<u16, String>>();
    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();

    let token_owned = token.map(|s| s.to_string());
    let data_dir_owned = data_dir.to_path_buf();

    std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
            .expect("tokio runtime for shadow server");

        rt.block_on(async move {
            let listener = match tokio::net::TcpListener::bind("127.0.0.1:0").await {
                Ok(l) => l,
                Err(e) => {
                    let _ = port_tx.send(Err(format!("bind failed: {e}")));
                    return;
                }
            };

            let port = match listener.local_addr() {
                Ok(addr) => addr.port(),
                Err(e) => {
                    let _ = port_tx.send(Err(e.to_string()));
                    return;
                }
            };

            let db_path = resolve_db_path(&data_dir_owned);
            let app_state = routes::AppState {
                data_dir: data_dir_owned.clone(),
                token: token_owned,
                port,
                recipes: Arc::new(
                    recipe_catalog::infrastructure::SqliteRecipeRepository::new(db_path.clone()),
                ),
                recipe_images: Arc::new(
                    recipe_catalog::infrastructure::FsRecipeImageStore::new(
                        data_dir_owned.join("recipe-images"),
                    ),
                ),
                consolidated_shopping_lists: Arc::new(
                    shopping_list::infrastructure::SqliteConsolidatedShoppingListRepository::new(
                        db_path.clone(),
                    ),
                ),
                saved_weekplan_reader: Arc::new(
                    planning::infrastructure::SqliteSavedWeekplanReader::new(db_path.clone()),
                ),
                weekplan_for_consolidation: Arc::new(
                    planning::infrastructure::SqliteWeekplanForConsolidationReader::new(db_path),
                ),
            };
            let router = routes::build_router(app_state);

            let _ = port_tx.send(Ok(port));
            axum::serve(listener, router)
                .with_graceful_shutdown(async {
                    shutdown_rx.await.ok();
                })
                .await
                .ok();
        });
    });

    let port = port_rx
        .recv_timeout(Duration::from_secs(10))
        .map_err(|_| "Shadow server did not start within 10s".to_string())?
        .map_err(|e| e)?;

    log::info!(
        "startup_timing desktop.shadow_server.started port={port}"
    );

    Ok(ShadowServerState {
        port,
        token: token.map(|s| s.to_string()),
        _shutdown_tx: shutdown_tx,
    })
}

/// Resolves the database path: `$DATABASE_PATH` → `data_dir/mealprepper.db`.
fn resolve_db_path(data_dir: &Path) -> PathBuf {
    if let Ok(path) = std::env::var("DATABASE_PATH") {
        let p = path.trim().to_string();
        if !p.is_empty() {
            return PathBuf::from(p);
        }
    }
    data_dir.join("mealprepper.db")
}
