use std::time::{Duration, Instant};

const HEALTH_PATH: &str = "/health";
const HEALTH_TIMEOUT: Duration = Duration::from_secs(60);
const HEALTH_POLL_INTERVAL: Duration = Duration::from_millis(200);

/// True when the Desktop Local API (Rust primary) should run as the loopback server.
///
/// Returns `true` in packaged / release builds and when `MEALPREPPER_SIDECAR=1` is set
/// (the dev-sidecar loop B script). Returns `false` under `tauri dev` (loop A) so the
/// Nuxt HMR server at `localhost:3000` is used directly without starting a local API.
pub fn should_run_sidecar() -> bool {
  if std::env::var("MEALPREPPER_SIDECAR").is_ok() {
    return true;
  }
  !tauri::is_dev()
}

/// Returns the JS initialization script that injects `window.__MEALPREPPER_DESKTOP__`
/// into the WebView before first navigation.
pub fn bootstrap_script(port: u16, token: &str) -> String {
  let api_base = format!("http://127.0.0.1:{port}");
  let payload = serde_json::json!({
    "apiBase": api_base,
    "token": token,
  });
  format!("window.__MEALPREPPER_DESKTOP__ = {};", payload)
}

/// Polls `GET /health` on `127.0.0.1:{port}` until 200 is returned or the timeout expires.
///
/// Used by the Tauri startup path to gate WebView navigation until the Desktop Local API
/// is fully ready to serve requests.
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
    "Desktop Local API did not become healthy at {url} within {}s",
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
