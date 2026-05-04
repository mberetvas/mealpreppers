import { randomUUID } from 'node:crypto'
import consola from 'consola'

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
