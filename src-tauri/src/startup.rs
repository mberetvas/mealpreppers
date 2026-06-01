//! Cold-start timing milestones for packaged desktop builds.

use std::time::Instant;

use crate::diagnostics;

/// True when startup timing logs should be emitted.
pub fn timing_enabled() -> bool {
  diagnostics::enabled() || diagnostics::env_flag("MEALPREPPER_STARTUP_TIMING")
}

/// Tracks setup milestones and emits one summary line when enabled.
pub struct StartupTiming {
  setup_begin: Instant,
  main_window_created: Option<Instant>,
  main_window_shown: Option<Instant>,
  sidecar_spawn: Option<Instant>,
  sidecar_healthy: Option<Instant>,
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
      sidecar_spawn: None,
      sidecar_healthy: None,
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

  pub fn mark_sidecar_spawned(&mut self) {
    self.sidecar_spawn = Some(Instant::now());
    self.log_milestone("sidecar_spawned");
  }

  pub fn mark_sidecar_healthy(&mut self) {
    self.sidecar_healthy = Some(Instant::now());
    self.log_milestone("sidecar_healthy");
  }

  pub fn mark_main_navigated(&mut self) {
    self.main_navigated = Some(Instant::now());
    self.log_milestone("main_navigated");
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
  pub fn log_summary(&self) {
    if !timing_enabled() {
      return;
    }

    let main_create_ms = self
      .main_window_created
      .map(|t| Self::ms_since(self.setup_begin, t))
      .unwrap_or(0);
    let main_show_ms = match (self.main_window_created, self.main_window_shown) {
      (Some(created), Some(shown)) => Self::ms_since(created, shown),
      _ => 0,
    };
    let sidecar_spawn_ms = match (self.main_window_shown, self.sidecar_spawn) {
      (Some(shown), Some(spawn)) => Self::ms_since(shown, spawn),
      _ => 0,
    };
    let health_wait_ms = match (self.sidecar_spawn, self.sidecar_healthy) {
      (Some(spawn), Some(healthy)) => Self::ms_since(spawn, healthy),
      _ => 0,
    };
    let main_navigate_ms = match (self.sidecar_healthy, self.main_navigated) {
      (Some(healthy), Some(navigated)) => Self::ms_since(healthy, navigated),
      _ => 0,
    };
    let total_setup_ms = self
      .main_navigated
      .or(self.sidecar_healthy)
      .or(self.main_window_shown)
      .or(self.main_window_created)
      .map(|t| Self::ms_since(self.setup_begin, t))
      .unwrap_or_else(|| self.setup_begin.elapsed().as_millis());

    let line = format!(
      "startup_timing main_create_ms={main_create_ms} main_show_ms={main_show_ms} sidecar_spawn_ms={sidecar_spawn_ms} health_wait_ms={health_wait_ms} main_navigate_ms={main_navigate_ms} total_setup_ms={total_setup_ms}"
    );
    log::info!("{line}");
    diagnostics::eprintln(&line);
  }
}
