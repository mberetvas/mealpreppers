//! Desktop Local API shadow server — phase 1 platform milestone.
//!
//! `start()` runs the in-process Axum server on a random `127.0.0.1` loopback port:
//! 1. Opens SQLite with WAL + FK and runs **Install database migrations**.
//! 2. Spawns a Tokio runtime on a background OS thread.
//! 3. Binds `127.0.0.1:0` and returns the assigned port + a shutdown handle.
//!
//! The returned `ShadowServerState` owns the shutdown sender; dropping it triggers
//! graceful shutdown of the Axum server.
//!
//! Nitro continues to serve all user-facing `/api/v1` routes in this phase. The shadow
//! server is a parallel listen-only process used for migrations and integration testing.

pub mod db;
pub mod error;
pub mod middleware;
pub mod request_context;
pub mod routes;

use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::time::Duration;

/// Handle for the running shadow server. Dropping this stops the server gracefully.
pub struct ShadowServerState {
    /// Loopback port the shadow server is listening on.
    pub port: u16,
    /// Sending a value (or dropping) triggers Axum graceful shutdown.
    _shutdown_tx: tokio::sync::oneshot::Sender<()>,
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
            let app_state = routes::AppState {
                data_dir: data_dir_owned,
                token: token_owned,
            };
            let router = routes::build_router(app_state);

            match tokio::net::TcpListener::bind("127.0.0.1:0").await {
                Ok(listener) => {
                    match listener.local_addr() {
                        Ok(addr) => {
                            let _ = port_tx.send(Ok(addr.port()));
                            axum::serve(listener, router)
                                .with_graceful_shutdown(async {
                                    shutdown_rx.await.ok();
                                })
                                .await
                                .ok();
                        }
                        Err(e) => {
                            let _ = port_tx.send(Err(e.to_string()));
                        }
                    }
                }
                Err(e) => {
                    let _ = port_tx.send(Err(format!("bind failed: {e}")));
                }
            }
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
