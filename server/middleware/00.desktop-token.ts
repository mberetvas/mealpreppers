import { defineEventHandler } from 'h3'
import { assertValidDesktopToken } from '../utils/desktopToken'

/**
 * When `DESKTOP_TOKEN` is set (Tauri sidecar), require `X-Desktop-Token` on all routes
 * except `/health`, using a timing-safe compare.
 */
export default defineEventHandler((event) => {
  assertValidDesktopToken(event)
})
