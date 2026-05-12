/**
 * Handler-level coverage for the recipe unexpected-error path:
 * verifies that the **Request Context Trace ID** (resolved by the trace middleware
 * and stored in `event.context.traceId`) is propagated into structured log entries
 * emitted by `handleRecipeUnexpected`, satisfying the recipe error correlation
 * requirement described in the **Application Logger** and **Trace ID** vocabulary.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'

vi.mock('../../server/utils/logger', () => ({
  appLogger: {
    withTag: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      withTag: vi.fn(),
    })),
  },
}))

const mocks = vi.hoisted(() => ({
  getRecipeById: vi.fn(),
  getSupabaseServerClient: vi.fn(() => ({})),
}))

vi.mock('../../server/db/supabaseClient', () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}))

vi.mock('../../server/services/recipe-catalog/recipeRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/services/recipe-catalog/recipeRepository')>()
  return {
    ...actual,
    getRecipeById: mocks.getRecipeById,
  }
})

import { appLogger } from '../../server/utils/logger'
import getRecipeByIdHandler from '../../server/api/v1/recipes/[id].get'

/** Builds a minimal H3Event with the **Request Context Trace ID** pre-set on context. */
function makeEvent(traceId?: string, recipeId = 'recipe-abc'): H3Event {
  const socket = new Socket()
  const req = new IncomingMessage(socket)
  req.headers = {}
  const res = new ServerResponse(req)
  const event = createEvent(req, res)
  if (traceId !== undefined) {
    (event.context as Record<string, unknown>).traceId = traceId
  }
  event.context.params = { id: recipeId }
  return event
}

describe('Recipe GET /:id handler — Request Context Trace ID propagation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('propagates the Request Context Trace ID into unexpected-error log entries', async () => {
    mocks.getRecipeById.mockRejectedValue(new Error('storage exploded'))

    const thrown = await getRecipeByIdHandler(makeEvent('trace-recipe-fail')).catch(e => e)

    expect(thrown).toMatchObject({
      statusCode: 500,
      statusMessage: 'The recipe service could not complete this request.',
    })
    expect(thrown.data?.errorId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )

    expect(vi.mocked(appLogger.withTag)).toHaveBeenCalledWith('recipes')
    const taggedLogger = vi.mocked(appLogger.withTag).mock.results[0]?.value as {
      error: ReturnType<typeof vi.fn>
    }
    expect(taggedLogger.error).toHaveBeenCalledWith(
      'recipe.unexpected_error',
      expect.objectContaining({
        traceId: 'trace-recipe-fail',
        operation: 'get recipe by id',
        errorId: thrown.data?.errorId,
      }),
    )
  })

  it('does not include the Request Context Trace ID in the error response body', async () => {
    mocks.getRecipeById.mockRejectedValue(new Error('boom'))

    const thrown = await getRecipeByIdHandler(makeEvent('trace-secret')).catch(e => e)

    expect(thrown.data).not.toHaveProperty('traceId')
  })

  it('passes through H3 errors without re-wrapping them', async () => {
    mocks.getRecipeById.mockRejectedValue({ statusCode: 404, statusMessage: 'Recipe not found.' })

    const thrown = await getRecipeByIdHandler(makeEvent('trace-pass-through')).catch(e => e)

    expect(thrown).toMatchObject({ statusCode: 404 })
  })
})
