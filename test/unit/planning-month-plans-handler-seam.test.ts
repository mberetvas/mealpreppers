/**
 * Handler-level coverage for Planning month-plan routes: verifies that the
 * **Request Context Trace ID** (from `event.context.traceId`, resolved by the
 * trace middleware) is propagated into unexpected-error log entries rather than
 * omitted, satisfying the **Planning Request Context** correlation requirement.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { appLogger } from '../../server/utils/logger'
import getMonthPlanHandler from '../../server/api/v1/planning/month-plans/[id].get'
import deleteMonthPlanHandler from '../../server/api/v1/planning/month-plans/[id].delete'
import listMonthPlansHandler from '../../server/api/v1/planning/month-plans/index.get'

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
  getMonthPlanById: vi.fn(),
  listMonthPlans: vi.fn(),
  deleteMonthPlan: vi.fn(),
  createMonthPlan: vi.fn(),
  updateMonthPlan: vi.fn(),
  assertRecipeIdsExist: vi.fn(),
  collectRecipeIdsFromMonthPlan: vi.fn(() => []),
  getDb: vi.fn(() => ({})),
}))

vi.mock('../../server/db/sqlite', () => ({
  getDb: mocks.getDb,
}))

vi.mock('../../server/services/planning/planningRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/services/planning/planningRepository')>()
  return {
    ...actual,
    getMonthPlanById: mocks.getMonthPlanById,
    listMonthPlans: mocks.listMonthPlans,
    deleteMonthPlan: mocks.deleteMonthPlan,
    createMonthPlan: mocks.createMonthPlan,
    updateMonthPlan: mocks.updateMonthPlan,
    assertRecipeIdsExist: mocks.assertRecipeIdsExist,
    collectRecipeIdsFromMonthPlan: mocks.collectRecipeIdsFromMonthPlan,
  }
})

/** Builds a minimal H3Event with the **Request Context Trace ID** pre-set on context. */
function makeEvent(traceId?: string): H3Event {
  const socket = new Socket()
  const req = new IncomingMessage(socket)
  req.headers = {}
  const res = new ServerResponse(req)
  const event = createEvent(req, res)
  if (traceId !== undefined) {
    (event.context as Record<string, unknown>).traceId = traceId
  }
  event.context.params = { id: 'plan-1' }
  return event
}

describe('Planning month-plan handlers — Request Context Trace ID propagation', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('GET /api/v1/planning/month-plans/:id', () => {
    it('returns the month plan on success', async () => {
      const plan = { id: 'plan-1', name: 'January' }
      mocks.getMonthPlanById.mockResolvedValue({ ok: true, value: plan })

      const out = await getMonthPlanHandler(makeEvent('trace-get'))

      expect(out).toEqual(plan)
    })

    it('propagates the Request Context Trace ID into unexpected-error log entries', async () => {
      mocks.getMonthPlanById.mockRejectedValue(new Error('storage exploded'))

      const thrown = await getMonthPlanHandler(makeEvent('trace-get-fail')).catch(e => e)

      expect(thrown).toMatchObject({
        statusCode: 500,
        statusMessage: 'The planner could not complete this request.',
      })
      expect(thrown.data?.errorId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )

      expect(vi.mocked(appLogger.withTag)).toHaveBeenCalledWith('planning-month-plans')
      const taggedLogger = vi.mocked(appLogger.withTag).mock.results[0]?.value as {
        error: ReturnType<typeof vi.fn>
      }
      expect(taggedLogger.error).toHaveBeenCalledWith(
        'planning.unexpected_error',
        expect.objectContaining({
          traceId: 'trace-get-fail',
          operation: 'get month plan',
          errorId: thrown.data?.errorId,
        }),
      )
    })

    it('does not include the Request Context Trace ID in the error response body', async () => {
      mocks.getMonthPlanById.mockRejectedValue(new Error('boom'))

      const thrown = await getMonthPlanHandler(makeEvent('trace-secret')).catch(e => e)

      expect(thrown.data).not.toHaveProperty('traceId')
    })
  })

  describe('DELETE /api/v1/planning/month-plans/:id', () => {
    it('propagates the Request Context Trace ID into unexpected-error log entries', async () => {
      mocks.deleteMonthPlan.mockRejectedValue(new Error('delete failed'))

      const thrown = await deleteMonthPlanHandler(makeEvent('trace-del-fail')).catch(e => e)

      expect(thrown).toMatchObject({ statusCode: 500 })
      const taggedLogger = vi.mocked(appLogger.withTag).mock.results[0]?.value as {
        error: ReturnType<typeof vi.fn>
      }
      expect(taggedLogger.error).toHaveBeenCalledWith(
        'planning.unexpected_error',
        expect.objectContaining({ traceId: 'trace-del-fail' }),
      )
    })
  })

  describe('GET /api/v1/planning/month-plans (list)', () => {
    it('propagates the Request Context Trace ID into unexpected-error log entries', async () => {
      mocks.listMonthPlans.mockRejectedValue(new Error('list failed'))

      const thrown = await listMonthPlansHandler(makeEvent('trace-list-fail')).catch(e => e)

      expect(thrown).toMatchObject({ statusCode: 500 })
      const taggedLogger = vi.mocked(appLogger.withTag).mock.results[0]?.value as {
        error: ReturnType<typeof vi.fn>
      }
      expect(taggedLogger.error).toHaveBeenCalledWith(
        'planning.unexpected_error',
        expect.objectContaining({ traceId: 'trace-list-fail' }),
      )
    })
  })
})
