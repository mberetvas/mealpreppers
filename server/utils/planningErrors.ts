import { randomUUID } from 'node:crypto'
import consola from 'consola'
import type { PlanningFailure } from '../services/planning/planningResult'

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
    case 'storage_error':
      return {
        statusCode: 500,
        statusMessage: error.message,
      }
  }
}

/**
 * Rethrows H3 errors from `createError`; logs and wraps unknown failures for planning APIs.
 */
export function handlePlanningUnexpected(err: unknown, tag: string, operation: string): never {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    throw err
  }
  const errorId = randomUUID()
  consola.withTag(tag).error(operation, { errorId, err })
  throw createError({
    statusCode: 500,
    statusMessage: 'The planner could not complete this request.',
    data: { errorId },
  })
}
