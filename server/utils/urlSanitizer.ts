/**
 * URL sanitization utilities for safe request metadata logging.
 *
 * Provides helpers to detect URL-shaped values and strip sensitive components
 * (userinfo, query string, fragment) before logging, retaining only
 * scheme, host, and path.
 */

/**
 * Returns true when `value` can be parsed as an absolute URL.
 * Relative paths and plain strings (e.g. `"true"`, `"42"`) return false.
 */
export function isUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

/**
 * Reduces `rawUrl` to `scheme://host/path`, stripping userinfo, query string,
 * and fragment. Returns the original string unchanged when it cannot be parsed
 * as a valid absolute URL.
 */
export function sanitizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    return `${url.protocol}//${url.host}${url.pathname}`
  } catch {
    return rawUrl
  }
}
