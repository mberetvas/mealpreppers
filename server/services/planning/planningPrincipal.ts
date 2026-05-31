import type { H3Event } from 'h3'
import { getLocalPlanningUserId } from './localPrincipal'

/** Local install-scoped caller for Saved Weekplans scoping. */
export type PlanningPrincipal = { kind: 'user', userId: string }

/** Resolves the current Saved Weekplans principal from request context or local install id. */
export function resolvePlanningPrincipal(event: H3Event): PlanningPrincipal {
  return resolvePlanningPrincipalFromEvent(event)
}

/** Resolves the Planning Principal from middleware context, falling back to the local install id. */
export function resolvePlanningPrincipalFromEvent(event: H3Event): PlanningPrincipal {
  const fromContext = (event.context as Record<string, unknown>).planningUserId
  if (typeof fromContext === 'string' && fromContext.trim() !== '') {
    return { kind: 'user', userId: fromContext.trim() }
  }
  return { kind: 'user', userId: getLocalPlanningUserId() }
}

/** Safe for logs (no raw user id). */
export function principalKindForLog(_principal: PlanningPrincipal): 'user' {
  return 'user'
}
