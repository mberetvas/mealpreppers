import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import { createError } from 'h3'
import { useTraceId } from '../../middleware/01.trace-context'
import { appLogger } from '../../utils/logger'
import type { StructuredLogger } from '../../utils/structuredLogger'
import { useStructuredLogger } from '../../utils/structuredLogger'
import type { PlanningPrincipal } from './planningPrincipal'
import { principalKindForLog, resolvePlanningPrincipalFromEvent } from './planningPrincipal'
import { resolveSupabaseUserIdFromBearer } from './planningSupabaseAuth'

/** Injectable seam for bearer-token-to-user-id resolution. Falls back to anonymous when null. */
export type PlanningAuthAdapter = (event: H3Event) => Promise<string | null>

/** Stable metadata declared once per Planning handler. */
export interface PlanningHandlerMeta {
  tag: string
  operation: string
}

/** Request-scoped context supplied to adopting Planning handlers. */
export interface PlanningRequestContext {
  traceId: string
  principal: PlanningPrincipal
  principalKind: 'user' | 'anonymous'
  logger: StructuredLogger
}

/**
 * Builds a PlanningRequestContext for the current request. Resolves the Planning
 * Principal via the auth adapter and binds a request-scoped logger to handler metadata.
 * Defaults to Supabase bearer resolution.
 */
export async function createPlanningRequestContext(
  event: H3Event,
  meta: PlanningHandlerMeta,
  authAdapter: PlanningAuthAdapter = resolveSupabaseUserIdFromBearer,
): Promise<PlanningRequestContext> {
  const traceId = useTraceId(event)
  const principal = await resolvePlanningPrincipalFromEvent(event, authAdapter)
  const principalKind = principalKindForLog(principal)
  const logger = useStructuredLogger(appLogger.withTag(meta.tag), traceId)
  return { traceId, principal, principalKind, logger }
}

/**
 * Planning handler wrapper. Builds PlanningRequestContext from stable handler metadata,
 * passes it alongside the event to the handler fn, and centralizes unexpected-error
 * logging with trace correlation. Expected H3 errors pass through unchanged; all others
 * are logged once and wrapped as the standard Planning 500 payload with an error identifier.
 */
export function withPlanningHandler<T>(
  meta: PlanningHandlerMeta,
  fn: (event: H3Event, ctx: PlanningRequestContext) => Promise<T>,
  authAdapter: PlanningAuthAdapter = resolveSupabaseUserIdFromBearer,
): (event: H3Event) => Promise<T> {
  return async (event: H3Event): Promise<T> => {
    let ctx: PlanningRequestContext | undefined
    try {
      ctx = await createPlanningRequestContext(event, meta, authAdapter)
      return await fn(event, ctx)
    }
    catch (err) {
      if (err && typeof err === 'object' && 'statusCode' in err) {
        throw err
      }
      const errorId = randomUUID()
      const logger = ctx?.logger ?? useStructuredLogger(appLogger.withTag(meta.tag), useTraceId(event))
      logger.error('planning.unexpected_error', { operation: meta.operation, errorId, err })
      throw createError({
        statusCode: 500,
        statusMessage: 'The planner could not complete this request.',
        data: { errorId },
      })
    }
  }
}
