import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import type { PlanningFailure } from '../services/planning/planningResult'
import { appLogger } from '../utils/logger'
import { useStructuredLogger } from '../utils/structuredLogger'

interface HttpErrorPayload {
  statusCode: number
  statusMessage: string
  data?: Record<string, unknown>
}

export function toPlanningHttpError(error: PlanningFailure): HttpErrorPayload {
  switch (error.kind) {
    case 'invalid_recipe_ids':
      return {
        statusCode: 400,
        statusMessage: error.message,
        data: { missingRecipeIds: error.missingRecipeIds },
      }
    case 'not_found':
      return {
        statusCode: 404,
        statusMessage: error.message,
      }
    case 'forbidden':
      return {
        statusCode: 403,
        statusMessage: error.message,
      }
    case 'deprecated_list':
      return {
        statusCode: 409,
        statusMessage: error.message,
      }
    case 'storage_error':
      return {
        statusCode: 500,
        statusMessage: error.message,
      }
  }
}

/**
 * Rethrows H3 errors from `createError`; logs and wraps unknown failures for planning APIs
 * via the **Application Logger**. Pass `traceId` (the **Trace ID** for the current request)
 * to correlate the structured log entry with the originating request.
 */
export function handlePlanningUnexpected(err: unknown, tag: string, operation: string, traceId?: string): never {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    throw err
  }
  const errorId = randomUUID()
  useStructuredLogger(appLogger.withTag(tag), traceId).error('planning.unexpected_error', { operation, errorId, err })
  throw createError({
    statusCode: 500,
    statusMessage: 'The planner could not complete this request.',
    data: { errorId },
  })
}
