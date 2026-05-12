import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import type { RecipeFailure } from '../services/recipe-catalog/recipeResult'
import { appLogger } from '../utils/logger'
import { useStructuredLogger } from '../utils/structuredLogger'

interface HttpErrorPayload {
  statusCode: number
  statusMessage: string
  data?: Record<string, unknown>
}

/** Maps domain recipe failures to Nitro HTTP error payloads. */
export function toRecipeHttpError(error: RecipeFailure): HttpErrorPayload {
  switch (error.kind) {
    case 'not_found':
      return { statusCode: 404, statusMessage: error.message }
    case 'storage_error':
      return { statusCode: 500, statusMessage: error.message }
  }
}

/**
 * Rethrows H3 errors from `createError`; logs and wraps unknown failures for recipe APIs.
 * Pass `traceId` (the **Request Context Trace ID**) to correlate the structured log entry
 * with the originating request via the **Application Logger**.
 */
export function handleRecipeUnexpected(err: unknown, tag: string, operation: string, traceId?: string): never {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    throw err
  }
  const errorId = randomUUID()
  useStructuredLogger(appLogger.withTag(tag), traceId).error('recipe.unexpected_error', { operation, errorId, err })
  throw createError({
    statusCode: 500,
    statusMessage: 'The recipe service could not complete this request.',
    data: { errorId },
  })
}
