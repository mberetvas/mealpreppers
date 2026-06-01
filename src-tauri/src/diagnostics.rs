//! Optional console and stderr logging for debugging packaged desktop builds.

/// True when debug logging / console attachment is enabled.
pub fn enabled() -> bool {
  cfg!(debug_assertions)
    || cfg!(feature = "console")
    || env_flag("MEALPREPPER_CONSOLE")
}

fn env_flag(name: &str) -> bool {
  std::env::var(name)
    .map(|v| matches!(v.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes"))
    .unwrap_or(false)
}

/// Prints to stderr when diagnostics are enabled (visible after [`maybe_attach_console`]).
pub fn eprintln(message: &str) {
  if enabled() {
    std::eprintln!("{message}");
  }
}

/// Attaches a Windows console when `MEALPREPPER_CONSOLE=1` (no rebuild required).
pub fn maybe_attach_console() {
  #[cfg(windows)]
  {
    if !env_flag("MEALPREPPER_CONSOLE") {
      return;
    }
    unsafe {
      #[link(name = "kernel32")]
      extern "system" {
        fn AllocConsole() -> i32;
      }
      let _ = AllocConsole();
    }
    eprintln!("Mealprepper: debug console attached (MEALPREPPER_CONSOLE).");
  }
}

/// Keeps the console open after a fatal startup error (double-click / Explorer launch).
pub fn pause_on_fatal_error() {
  if !enabled() {
    return;
  }
  eprintln!("Press Enter to close...");
  let mut line = String::new();
  let _ = std::io::stdin().read_line(&mut line);
}
