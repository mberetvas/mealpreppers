use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use std::io::Read;

use crate::diagnostics;
use crate::keychain;
use crate::startup::{self, StartupTiming};

const HEALTH_PATH: &str = "/health";
const HEALTH_TIMEOUT: Duration = Duration::from_secs(60);
const HEALTH_POLL_INTERVAL: Duration = Duration::from_millis(200);

pub struct SidecarLaunch {
  pub port: u16,
  pub token: String,
  pub data_dir: PathBuf,
}

pub struct SidecarState {
  pub port: u16,
  child: Mutex<Option<Child>>,
}

impl SidecarState {
  pub fn api_base(&self) -> String {
    format!("http://127.0.0.1:{}", self.port)
  }

  pub fn stop(&self) {
    if let Ok(mut guard) = self.child.lock() {
      if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
      }
    }
  }
}

/// True when the packaged Nitro sidecar should run (not `tauri dev` loop A).
pub fn should_run_sidecar() -> bool {
  if std::env::var("MEALPREPPER_SIDECAR").is_ok() {
    return true;
  }
  !tauri::is_dev()
}

pub fn bootstrap_script(port: u16, token: &str) -> String {
  let api_base = format!("http://127.0.0.1:{port}");
  let payload = serde_json::json!({
    "apiBase": api_base,
    "token": token,
  });
  format!("window.__MEALPREPPER_DESKTOP__ = {};", payload)
}

pub fn prepare_sidecar_launch(app: &AppHandle) -> Result<SidecarLaunch, String> {
  let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
  let port = pick_loopback_port()?;
  let token = Uuid::new_v4().to_string();
  Ok(SidecarLaunch {
    port,
    token,
    data_dir,
  })
}

pub fn finish_sidecar_launch(
  app: &AppHandle,
  launch: SidecarLaunch,
  timing: &mut StartupTiming,
) -> Result<SidecarState, String> {
  let SidecarLaunch {
    port,
    token,
    data_dir,
  } = launch;
  let mut child = spawn_nitro(app, port, &token, &data_dir)?;
  timing.mark_sidecar_spawned();

  log::info!(
    "Started Nitro sidecar on 127.0.0.1:{port} (pid {})",
    child.id()
  );

  if let Err(mut health_err) = wait_for_health(port) {
    if diagnostics::enabled() {
      let stderr = read_child_stderr(&mut child);
      health_err.push_str("\n\n--- Nitro sidecar stderr ---\n");
      health_err.push_str(&stderr);
    }
    let _ = child.kill();
    let _ = child.wait();
    return Err(health_err);
  }

  log::info!("Nitro sidecar health check passed");
  timing.mark_sidecar_healthy();

  Ok(SidecarState {
    port,
    child: Mutex::new(Some(child)),
  })
}

fn resolve_resource(app: &AppHandle, path: &str) -> Result<PathBuf, String> {
  app.path()
    .resolve(path, BaseDirectory::Resource)
    .map_err(|e| e.to_string())
}

fn node_executable(app: &AppHandle) -> Result<PathBuf, String> {
  #[cfg(windows)]
  {
    return resolve_resource(app, "node/win-x64/node.exe");
  }
  #[cfg(target_os = "macos")]
  {
    return resolve_resource(app, "node/darwin-x64/bin/node");
  }
  #[cfg(target_os = "linux")]
  {
    return resolve_resource(app, "node/linux-x64/bin/node");
  }
}

fn server_entry(app: &AppHandle) -> Result<PathBuf, String> {
  resolve_resource(app, "nitro/server/index.mjs")
}

fn pick_loopback_port() -> Result<u16, String> {
  let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
  Ok(listener.local_addr().map_err(|e| e.to_string())?.port())
}

fn spawn_nitro(app: &AppHandle, port: u16, token: &str, data_dir: &Path) -> Result<Child, String> {
  let node = node_executable(app)?;
  let entry = server_entry(app)?;

  if !node.is_file() {
    return Err(format!(
      "Bundled Node runtime not found at {}. Run `bun run build:desktop` first.",
      node.display()
    ));
  }
  if !entry.is_file() {
    return Err(format!(
      "Nitro sidecar entry not found at {}. Run `bun run build:desktop` first.",
      entry.display()
    ));
  }

  let server_dir = entry
    .parent()
    .ok_or_else(|| "Invalid Nitro server path".to_string())?;

  let database_path = data_dir.join("mealprepper.db");

  let mut command = Command::new(&node);
  command
    .arg(&entry)
    .current_dir(server_dir)
    .env("HOST", "127.0.0.1")
    .env("NITRO_HOST", "127.0.0.1")
    .env("PORT", port.to_string())
    .env("NITRO_PORT", port.to_string())
    .env("DESKTOP_TOKEN", token)
    .env("MEALPREPPER_DATA_DIR", data_dir)
    .env("DATABASE_PATH", &database_path);

  if let Some(api_key) = keychain::read_openrouter_key() {
    command.env("OPENROUTER_API_KEY", api_key);
    log::info!("Injected OPENROUTER_API_KEY from keychain into Nitro sidecar environment");
  }

  if startup::timing_enabled() {
    command.env("MEALPREPPER_STARTUP_TIMING", "1");
  }

  command
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()
    .map_err(|e| format!("Failed to spawn Nitro sidecar: {e}"))
}

fn read_child_stderr(child: &mut Child) -> String {
  let Some(mut stderr) = child.stderr.take() else {
    return String::from("(no stderr pipe)");
  };
  let mut buf = Vec::new();
  if stderr.read_to_end(&mut buf).is_err() {
    return String::from("(failed to read stderr)");
  }
  let text = String::from_utf8_lossy(&buf).trim().to_string();
  if text.is_empty() {
    return String::from("(empty)");
  }
  text
}

pub fn wait_for_health(port: u16) -> Result<(), String> {
  let url = format!("http://127.0.0.1:{port}{HEALTH_PATH}");
  let started = Instant::now();

  while started.elapsed() < HEALTH_TIMEOUT {
    match ureq::get(&url).call() {
      Ok(response) if response.status() == 200 => return Ok(()),
      Ok(_) | Err(_) => std::thread::sleep(HEALTH_POLL_INTERVAL),
    }
  }

  Err(format!(
    "Nitro sidecar did not become healthy at {url} within {}s",
    HEALTH_TIMEOUT.as_secs()
  ))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn bootstrap_script_sets_desktop_global() {
    let script = bootstrap_script(49152, "test-token");
    assert!(script.contains("window.__MEALPREPPER_DESKTOP__"));
    assert!(script.contains("\"apiBase\":\"http://127.0.0.1:49152\""));
    assert!(script.contains("\"token\":\"test-token\""));
  }
}
