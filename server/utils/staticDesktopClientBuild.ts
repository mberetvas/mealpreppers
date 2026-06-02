/** True during `scripts/build-desktop.mjs` (Tauri static bundle; Rust serves `/api/v1`). */
export function isStaticDesktopClientBuild(): boolean {
  return process.env.MEALPREPPER_STATIC_CLIENT_BUILD === '1'
}
