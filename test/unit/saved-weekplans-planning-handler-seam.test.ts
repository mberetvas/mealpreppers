/**
 * Handler-level coverage for Saved Weekplans routes that adopt `withPlanningHandler`
 * (list + patch): principal/trace/logger flow and unexpected-error wrapping.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'
import { appLogger } from '../../server/utils/logger'
import listSavedWeekplansHandler from '../../server/api/v1/saved-weekplans/index.get'
import patchSavedWeekplanHandler from '../../server/api/v1/saved-weekplans/[id].patch'

const h3Mocks = vi.hoisted(() => ({
  readBody: vi.fn(),
}))

vi.mock('h3', async (importOriginal) => {
  const mod = await importOriginal<typeof import('h3')>()
  return {
    ...mod,
    readBody: h3Mocks.readBody,
  }
})

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
  listSavedWeekplans: vi.fn(),
  updateSavedWeekplan: vi.fn(),
  getDb: vi.fn(() => ({})),
}))

vi.mock('../../server/db/sqlite', () => ({
  getDb: mocks.getDb,
}))

vi.mock('../../server/services/planning/savedWeekplansRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/services/planning/savedWeekplansRepository')>()
  return {
    ...actual,
    listSavedWeekplans: mocks.listSavedWeekplans,
    updateSavedWeekplan: mocks.updateSavedWeekplan,
  }
})

const SESSION_UUID = '550e8400-e29b-41d4-a716-446655440000'

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
  event.node.req.headers.cookie = `mp_planning_session=${SESSION_UUID}`
  return event
}

describe('saved-weekplans handlers via Planning Request Context seam', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h3Mocks.readBody.mockResolvedValue({ name: 'Renamed' })
  })

  it('GET list delegates to listSavedWeekplans with the resolved Planning principal', async () => {
    const rows = [{ id: 'w1', name: 'Week', updatedAt: '2026-01-01T00:00:00.000Z' }]
    mocks.listSavedWeekplans.mockResolvedValue({ ok: true, value: rows })

    const event = makeEvent('trace-list')
    const out = await listSavedWeekplansHandler(event)

    expect(out).toEqual(rows)
    expect(mocks.listSavedWeekplans).toHaveBeenCalledWith(
      {},
      { kind: 'anonymous', sessionId: SESSION_UUID },
    )
  })

  it('GET list wraps unexpected failures with Planning 500 and trace-correlated logging', async () => {
    mocks.listSavedWeekplans.mockRejectedValue(new Error('storage blew up'))

    const event = makeEvent('trace-list-bad')
    const thrown = await listSavedWeekplansHandler(event).catch(e => e)

    expect(thrown).toMatchObject({
      statusCode: 500,
      statusMessage: 'The planner could not complete this request.',
    })
    expect(thrown.data?.errorId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )

    const taggedLogger = vi.mocked(appLogger.withTag).mock.results[0]?.value as {
      error: ReturnType<typeof vi.fn>
    }
    expect(taggedLogger.error).toHaveBeenCalledWith(
      'planning.unexpected_error',
      expect.objectContaining({
        traceId: 'trace-list-bad',
        operation: 'list saved weekplans',
        errorId: thrown.data?.errorId,
      }),
    )
  })

  it('PATCH wraps unexpected failures from updateSavedWeekplan with Planning 500', async () => {
    mocks.updateSavedWeekplan.mockRejectedValue(new Error('unexpected'))

    const event = makeEvent('trace-patch-bad')
    const thrown = await patchSavedWeekplanHandler(event).catch(e => e)

    expect(thrown).toMatchObject({
      statusCode: 500,
      statusMessage: 'The planner could not complete this request.',
    })

    const taggedLogger = vi.mocked(appLogger.withTag).mock.results[0]?.value as {
      error: ReturnType<typeof vi.fn>
    }
    expect(taggedLogger.error).toHaveBeenCalledWith(
      'planning.unexpected_error',
      expect.objectContaining({
        traceId: 'trace-patch-bad',
        operation: 'patch saved weekplan',
      }),
    )
  })
})
