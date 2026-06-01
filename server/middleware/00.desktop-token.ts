import { defineEventHandler } from 'h3'
import { assertValidDesktopToken } from '../utils/desktopToken'

/**
 * When `DESKTOP_TOKEN` is set (Tauri sidecar), require `X-Desktop-Token` on `/api/**`
 * routes using a timing-safe compare. Page loads and static assets stay unauthenticated.
 */
export default defineEventHandler((event) => {
  assertValidDesktopToken(event)
})
