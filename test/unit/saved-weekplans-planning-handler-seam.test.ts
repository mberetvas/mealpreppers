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
import deleteSavedWeekplanHandler from '../../server/api/v1/saved-weekplans/[id].delete'
import getSavedWeekplanHandler from '../../server/api/v1/saved-weekplans/[id].get'
import listSavedWeekplansHandler from '../../server/api/v1/saved-weekplans/index.get'
import patchSavedWeekplanHandler from '../../server/api/v1/saved-weekplans/[id].patch'

const LOCAL_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

vi.mock('../../server/services/planning/localPrincipal', () => ({
  getLocalPlanningUserId: () => LOCAL_USER_ID,
  backfillLocalPrincipalOwnership: vi.fn(),
}))

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
  getSavedWeekplanWithShoppingListFlags: vi.fn(),
  updateSavedWeekplan: vi.fn(),
  deleteSavedWeekplan: vi.fn(),
  getDb: vi.fn(() => ({})),
  savedWeekplanReader: { listForPrincipal: vi.fn(), getById: vi.fn(), getForConsolidatedListOps: vi.fn() },
}))

vi.mock('../../server/db/sqlite', () => ({
  getDb: mocks.getDb,
}))

vi.mock('../../server/services/planning/planningComposition', () => ({
  createPlanningDeps: () => ({
    savedWeekplanReader: mocks.savedWeekplanReader,
    createSavedWeekplanDeps: {},
  }),
}))

vi.mock('../../server/services/planning/savedWeekplansRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/services/planning/savedWeekplansRepository')>()
  return {
    ...actual,
    listSavedWeekplans: mocks.listSavedWeekplans,
    getSavedWeekplanWithShoppingListFlags: mocks.getSavedWeekplanWithShoppingListFlags,
    updateSavedWeekplan: mocks.updateSavedWeekplan,
    deleteSavedWeekplan: mocks.deleteSavedWeekplan,
  }
})

function makeEvent(traceId?: string, planningUserId?: string): H3Event {
  const socket = new Socket()
  const req = new IncomingMessage(socket)
  req.headers = {}
  const res = new ServerResponse(req)
  const event = createEvent(req, res)
  const context = event.context as Record<string, unknown>
  if (traceId !== undefined) {
    context.traceId = traceId
  }
  if (planningUserId !== undefined) {
    context.planningUserId = planningUserId
  }
  context.params = { id: 'plan-1' }
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

    const event = makeEvent('trace-list', LOCAL_USER_ID)
    const out = await listSavedWeekplansHandler(event)

    expect(out).toEqual(rows)
    expect(mocks.listSavedWeekplans).toHaveBeenCalledWith(
      {},
      { kind: 'user', userId: LOCAL_USER_ID },
      mocks.savedWeekplanReader,
    )
  })

  it('GET list wraps unexpected failures with Planning 500 and trace-correlated logging', async () => {
    mocks.listSavedWeekplans.mockRejectedValue(new Error('storage blew up'))

    const event = makeEvent('trace-list-bad', LOCAL_USER_ID)
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

  it('GET by id delegates to getSavedWeekplanWithShoppingListFlags with the composition-root reader', async () => {
    const row = {
      id: 'plan-1',
      name: 'Week',
      body: { version: 'week_v1', days: [] },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      hasSavedShoppingList: false,
      shoppingListDeprecated: false,
    }
    mocks.getSavedWeekplanWithShoppingListFlags.mockResolvedValue({ ok: true, value: row })

    const event = makeEvent('trace-get', LOCAL_USER_ID)
    const out = await getSavedWeekplanHandler(event)

    expect(out).toEqual(row)
    expect(mocks.getSavedWeekplanWithShoppingListFlags).toHaveBeenCalledWith(
      {},
      'plan-1',
      { kind: 'user', userId: LOCAL_USER_ID },
      mocks.savedWeekplanReader,
    )
  })

  it('PATCH delegates to updateSavedWeekplan with the composition-root reader', async () => {
    const row = {
      id: 'plan-1',
      name: 'Renamed',
      body: { version: 'week_v1', days: [] },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    }
    mocks.updateSavedWeekplan.mockResolvedValue({ ok: true, value: row })

    const event = makeEvent('trace-patch', LOCAL_USER_ID)
    const out = await patchSavedWeekplanHandler(event)

    expect(out).toEqual(row)
    expect(mocks.updateSavedWeekplan).toHaveBeenCalledWith(
      {},
      'plan-1',
      { kind: 'user', userId: LOCAL_USER_ID },
      { name: 'Renamed' },
      mocks.savedWeekplanReader,
    )
  })

  it('DELETE delegates to deleteSavedWeekplan with the composition-root reader', async () => {
    mocks.deleteSavedWeekplan.mockResolvedValue({ ok: true, value: { ok: true } })

    const event = makeEvent('trace-delete', LOCAL_USER_ID)
    const out = await deleteSavedWeekplanHandler(event)

    expect(out).toEqual({ ok: true })
    expect(mocks.deleteSavedWeekplan).toHaveBeenCalledWith(
      {},
      'plan-1',
      { kind: 'user', userId: LOCAL_USER_ID },
      mocks.savedWeekplanReader,
    )
  })

  it('PATCH wraps unexpected failures from updateSavedWeekplan with Planning 500', async () => {
    mocks.updateSavedWeekplan.mockRejectedValue(new Error('unexpected'))

    const event = makeEvent('trace-patch-bad', LOCAL_USER_ID)
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
