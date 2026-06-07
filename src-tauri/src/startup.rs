//! Cold-start timing milestones for packaged desktop builds.

use std::time::Instant;

use crate::diagnostics;

/// True when startup timing logs should be emitted.
pub fn timing_enabled() -> bool {
  diagnostics::enabled() || diagnostics::env_flag("MEALPREPPER_STARTUP_TIMING")
}

/// Tracks setup milestones and emits one summary line when enabled.
///
/// **Cutover milestone sequence** (Rust primary API):
/// 1. `setup_begin` — `StartupTiming::begin()`
/// 2. `rust_api_spawned` — Rust API bound on loopback
/// 3. `main_window_created` — blank shell WebView built
/// 4. `main_window_shown` — window visible (before health)
/// 5. `rust_api_healthy` — `/health` 200 from Rust API
/// 6. `main_navigated` — WebView navigated to `apiBase`
pub struct StartupTiming {
  setup_begin: Instant,
  main_window_created: Option<Instant>,
  main_window_shown: Option<Instant>,
  /// Desktop Local API (Rust primary) bound and listening.
  rust_api_spawned: Option<Instant>,
  /// Desktop Local API `/health` returned 200.
  rust_api_healthy: Option<Instant>,
  main_navigated: Option<Instant>,
}

impl StartupTiming {
  pub fn begin() -> Self {
    let setup_begin = Instant::now();
    if timing_enabled() {
      log::info!("startup_timing milestone=setup_begin elapsed_ms=0");
    }
    Self {
      setup_begin,
      main_window_created: None,
      main_window_shown: None,
      rust_api_spawned: None,
      rust_api_healthy: None,
      main_navigated: None,
    }
  }

  pub fn mark_main_window_created(&mut self) {
    self.main_window_created = Some(Instant::now());
    self.log_milestone("main_window_created");
  }

  pub fn mark_main_window_shown(&mut self) {
    self.main_window_shown = Some(Instant::now());
    self.log_milestone("main_window_shown");
  }

  pub fn mark_main_navigated(&mut self) {
    self.main_navigated = Some(Instant::now());
    self.log_milestone("main_navigated");
  }

  /// Records when the Desktop Local API (Rust primary) is bound and accepting requests.
  pub fn mark_rust_api_spawned(&mut self) {
    self.rust_api_spawned = Some(Instant::now());
    self.log_milestone("rust_api_spawned");
  }

  /// Records when the Desktop Local API `/health` returned 200.
  pub fn mark_rust_api_healthy(&mut self) {
    self.rust_api_healthy = Some(Instant::now());
    self.log_milestone("rust_api_healthy");
  }

  fn log_milestone(&self, name: &str) {
    if !timing_enabled() {
      return;
    }
    let elapsed_ms = self.setup_begin.elapsed().as_millis();
    log::info!("startup_timing milestone={name} elapsed_ms={elapsed_ms}");
  }

  fn ms_since(from: Instant, to: Instant) -> u128 {
    to.duration_since(from).as_millis()
  }

  /// Logs `startup_timing …` to stderr and the Tauri log plugin when enabled.
  ///
  /// Summary fields (Rust primary path):
  /// - `rust_api_spawn_ms`        — setup_begin → Rust API bound
  /// - `main_shell_ms`            — setup_begin → main window created
  /// - `rust_api_health_wait_ms`  — Rust API spawned → `/health` 200
  /// - `main_navigate_ms`         — rust_api_healthy → main window navigated
  /// - `total_setup_ms`           — setup_begin → main_navigated (or last milestone)
  pub fn log_summary(&self) {
    if !timing_enabled() {
      return;
    }

    let rust_api_spawn_ms = self
      .rust_api_spawned
      .map(|t| Self::ms_since(self.setup_begin, t))
      .unwrap_or(0);

    let main_shell_ms = self
      .main_window_created
      .map(|t| Self::ms_since(self.setup_begin, t))
      .unwrap_or(0);

    let rust_api_health_wait_ms = match (self.rust_api_spawned, self.rust_api_healthy) {
      (Some(spawn), Some(healthy)) => Self::ms_since(spawn, healthy),
      _ => 0,
    };

    let main_navigate_ms = match (self.rust_api_healthy, self.main_navigated) {
      (Some(healthy), Some(navigated)) => Self::ms_since(healthy, navigated),
      _ => 0,
    };

    let total_setup_ms = self
      .main_navigated
      .or(self.rust_api_healthy)
      .or(self.main_window_shown)
      .or(self.main_window_created)
      .or(self.rust_api_spawned)
      .map(|t| Self::ms_since(self.setup_begin, t))
      .unwrap_or_else(|| self.setup_begin.elapsed().as_millis());

    let line = format!(
      "startup_timing rust_api_spawn_ms={rust_api_spawn_ms} main_shell_ms={main_shell_ms} rust_api_health_wait_ms={rust_api_health_wait_ms} main_navigate_ms={main_navigate_ms} total_setup_ms={total_setup_ms}"
    );
    log::info!("{line}");
    diagnostics::eprintln(&line);
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn mark_rust_api_milestones_do_not_panic() {
    let mut t = StartupTiming::begin();
    t.mark_rust_api_spawned();
    t.mark_main_window_created();
    t.mark_main_window_shown();
    t.mark_rust_api_healthy();
    t.mark_main_navigated();
    // log_summary is a no-op when timing not enabled; just verify no panic
    t.log_summary();
  }

  #[test]
  fn rust_api_milestones_are_independent_of_sidecar() {
    // Verify the struct can be constructed and milestones set without any sidecar fields
    let mut t = StartupTiming::begin();
    t.mark_rust_api_spawned();
    t.mark_rust_api_healthy();
    // rust_api_health_wait_ms should be ≥ 0 (non-negative duration)
    // Just ensure no panic during construction/use
    let _ = t;
  }
}

