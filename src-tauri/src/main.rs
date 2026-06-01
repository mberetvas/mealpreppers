// Hide the console in release unless the `console` feature or MEALPREPPER_CONSOLE is used.
#![cfg_attr(
  all(not(debug_assertions), not(feature = "console")),
  windows_subsystem = "windows"
)]

fn main() {
  mealprepper_lib::maybe_attach_console();
  mealprepper_lib::run();
}
