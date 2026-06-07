import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import { createError } from 'h3'
import { useTraceId } from '../../middleware/01.trace-context'
import { appLogger } from '../../utils/logger'
import type { StructuredLogger } from '../../utils/structuredLogger'
import { useStructuredLogger } from '../../utils/structuredLogger'
import type { PlanningPrincipal } from './planningPrincipal'
import { principalKindForLog, resolvePlanningPrincipalFromEvent } from './planningPrincipal'

/** Stable metadata declared once per Planning handler. */
export interface PlanningHandlerMeta {
  tag: string
  operation: string
}

/** Request-scoped context supplied to adopting Planning handlers. */
export interface PlanningRequestContext {
  /** The **Request Context Trace ID** resolved by the trace middleware and stored on the event context. */
  traceId: string
  principal: PlanningPrincipal
  principalKind: 'user'
  /** Structured logger pre-bound to the handler tag and **Request Context Trace ID** for log correlation. */
  logger: StructuredLogger
}

/**
 * Builds a **Planning Request Context** for the current request. Resolves the Planning
 * Principal from middleware context and binds a request-scoped logger to handler metadata
 * using the **Request Context Trace ID** from `event.context.traceId`.
 */
export function createPlanningRequestContext(
  event: H3Event,
  meta: PlanningHandlerMeta,
): PlanningRequestContext {
  const traceId = useTraceId(event)
  const principal = resolvePlanningPrincipalFromEvent(event)
  const principalKind = principalKindForLog(principal)
  const logger = useStructuredLogger(appLogger.withTag(meta.tag), traceId)
  return { traceId, principal, principalKind, logger }
}

/**
 * Planning handler wrapper. Builds a **Planning Request Context** from stable handler metadata,
 * passes it alongside the event to the handler fn, and centralizes unexpected-error
 * logging with **Trace ID** correlation. Expected H3 errors pass through unchanged; all others
 * are logged once using the **Request Context Trace ID** and wrapped as the standard
 * Planning 500 payload with an error identifier.
 */
export function withPlanningHandler<T>(
  meta: PlanningHandlerMeta,
  fn: (event: H3Event, ctx: PlanningRequestContext) => Promise<T>,
): (event: H3Event) => Promise<T> {
  return async (event: H3Event): Promise<T> => {
    let ctx: PlanningRequestContext | undefined
    try {
      ctx = createPlanningRequestContext(event, meta)
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
