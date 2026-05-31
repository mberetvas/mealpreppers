/**
 * Liveness probe for the Nitro sidecar (Tauri waits on this before showing the WebView).
 */
export default defineEventHandler(() => ({
  ok: true,
}))
