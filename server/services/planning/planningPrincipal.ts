import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import { deleteCookie, getCookie, setCookie } from 'h3'

/** HttpOnly cookie carrying the anonymous Saved Weekplans session id (opaque UUID). */
export const ANON_PLANNING_SESSION_COOKIE = 'mp_planning_session'

/** Authenticated or anonymous caller for Saved Weekplans scoping. */
export type PlanningPrincipal =
  | { kind: 'user', userId: string }
  | { kind: 'anonymous', sessionId: string }

/**
 * Ensures the response has a stable anonymous planning session cookie; returns its value.
 */
export function ensureAnonymousPlanningSession(event: H3Event): string {
  const existing = readAnonymousPlanningSessionCookie(event)
  if (existing) return existing

  const sessionId = randomUUID()
  setCookie(event, ANON_PLANNING_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 400,
    secure: process.env.NODE_ENV === 'production',
  })
  return sessionId
}

/** Returns the anonymous planning session id when already present; does not mint a new cookie. */
export function readAnonymousPlanningSessionCookie(event: H3Event): string | undefined {
  const existing = getCookie(event, ANON_PLANNING_SESSION_COOKIE)?.trim()
  if (existing && isUuid(existing)) return existing
  return undefined
}

/** Clears the anonymous planning session cookie after handoff or discard. */
export function clearAnonymousPlanningSessionCookie(event: H3Event): void {
  deleteCookie(event, ANON_PLANNING_SESSION_COOKIE, {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
}

/**
 * Resolves the current Saved Weekplans principal. Authenticated users take precedence
 * when `event.context.planningUserId` is set by future auth middleware; otherwise an
 * anonymous session cookie is issued or reused.
 */
export function resolvePlanningPrincipal(event: H3Event): PlanningPrincipal {
  const fromContext = (event.context as Record<string, unknown>).planningUserId
  if (typeof fromContext === 'string' && fromContext.trim() !== '') {
    return { kind: 'user', userId: fromContext.trim() }
  }
  return { kind: 'anonymous', sessionId: ensureAnonymousPlanningSession(event) }
}

/** Safe for logs (no raw session / user id). */
export function principalKindForLog(principal: PlanningPrincipal): 'user' | 'anonymous' {
  return principal.kind
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
