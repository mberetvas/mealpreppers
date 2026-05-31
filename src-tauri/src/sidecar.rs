use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};
use uuid::Uuid;

use crate::keychain;

const HEALTH_PATH: &str = "/health";
const HEALTH_TIMEOUT: Duration = Duration::from_secs(60);
const HEALTH_POLL_INTERVAL: Duration = Duration::from_millis(200);

pub struct SidecarState {
  pub port: u16,
  pub token: String,
  child: Mutex<Option<Child>>,
}

impl SidecarState {
  pub fn api_base(&self) -> String {
    format!("http://127.0.0.1:{}", self.port)
  }

  pub fn bootstrap_script(&self) -> String {
    let payload = serde_json::json!({
      "apiBase": self.api_base(),
      "token": self.token,
    });
    format!("window.__MEALPREPPER_DESKTOP__ = {};", payload)
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
  std::env::var("TAURI_ENV").as_deref() != Ok("dev")
}

fn node_executable(resource_dir: &Path) -> PathBuf {
  #[cfg(windows)]
  {
    return resource_dir.join("node").join("win-x64").join("node.exe");
  }
  #[cfg(target_os = "macos")]
  {
    return resource_dir
      .join("node")
      .join("darwin-x64")
      .join("bin")
      .join("node");
  }
  #[cfg(target_os = "linux")]
  {
    return resource_dir
      .join("node")
      .join("linux-x64")
      .join("bin")
      .join("node");
  }
}

fn server_entry(resource_dir: &Path) -> PathBuf {
  resource_dir.join("nitro").join("server").join("index.mjs")
}

fn pick_loopback_port() -> Result<u16, String> {
  let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
  Ok(listener.local_addr().map_err(|e| e.to_string())?.port())
}

fn spawn_nitro(resource_dir: &Path, port: u16, token: &str, data_dir: &Path) -> Result<Child, String> {
  let node = node_executable(resource_dir);
  let entry = server_entry(resource_dir);

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

  command
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()
    .map_err(|e| format!("Failed to spawn Nitro sidecar: {e}"))
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

pub fn start_sidecar(app: &AppHandle) -> Result<SidecarState, String> {
  let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
  let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
  let port = pick_loopback_port()?;
  let token = Uuid::new_v4().to_string();
  let child = spawn_nitro(&resource_dir, port, &token, &data_dir)?;

  log::info!(
    "Started Nitro sidecar on 127.0.0.1:{port} (pid {})",
    child.id()
  );

  wait_for_health(port)?;
  log::info!("Nitro sidecar health check passed");

  Ok(SidecarState {
    port,
    token,
    child: Mutex::new(Some(child)),
  })
}
