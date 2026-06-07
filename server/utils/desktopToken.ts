import { timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { createError, getHeader, getRequestURL } from 'h3'

/** Header the desktop WebView sends on loopback API calls. */
export const DESKTOP_TOKEN_HEADER = 'x-desktop-token'

/** Returns the expected token from the process environment (unset outside desktop sidecar context). */
export function getExpectedDesktopToken(): string | undefined {
  const token = process.env.DESKTOP_TOKEN?.trim()
  return token && token.length > 0 ? token : undefined
}

/** True when desktop token enforcement is active for this process. */
export function isDesktopTokenEnforced(): boolean {
  return getExpectedDesktopToken() !== undefined
}

/** API paths that require the desktop token when enforcement is active. */
export function isDesktopTokenProtectedPath(pathname: string): boolean {
  return pathname.startsWith('/api/')
}

/** Timing-safe comparison of desktop tokens. */
export function desktopTokensMatch(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided)
  const expectedBuf = Buffer.from(expected)
  if (providedBuf.length !== expectedBuf.length) {
    return false
  }
  return timingSafeEqual(providedBuf, expectedBuf)
}

/** Rejects the request when enforcement is on and the token header is missing or invalid. */
export function assertValidDesktopToken(event: H3Event): void {
  const expected = getExpectedDesktopToken()
  if (!expected) {
    return
  }

  const { pathname } = getRequestURL(event)
  if (!isDesktopTokenProtectedPath(pathname)) {
    return
  }

  const provided = getHeader(event, DESKTOP_TOKEN_HEADER)?.trim() ?? ''
  if (!provided || !desktopTokensMatch(provided, expected)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Invalid or missing desktop token',
    })
  }
}
