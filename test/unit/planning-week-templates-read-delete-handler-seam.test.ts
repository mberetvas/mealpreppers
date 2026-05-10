/**
 * Legacy week-template read/delete routes adopt `withPlanningHandler` while keeping unscoped repository calls.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { emptyWeekPlan } from '../../utils/weekPlan'

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
  listWeekTemplates: vi.fn(),
  getWeekTemplateById: vi.fn(),
  deleteWeekTemplate: vi.fn(),
  getSupabaseServerClient: vi.fn(() => ({})),
}))

vi.mock('../../server/db/supabaseClient', () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}))

vi.mock('../../server/services/planning/planningRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/services/planning/planningRepository')>()
  return {
    ...actual,
    listWeekTemplates: mocks.listWeekTemplates,
    getWeekTemplateById: mocks.getWeekTemplateById,
    deleteWeekTemplate: mocks.deleteWeekTemplate,
  }
})

import { appLogger } from '../../server/utils/logger'
import listWeekTemplatesHandler from '../../server/api/v1/planning/week-templates/index.get'
import getWeekTemplateHandler from '../../server/api/v1/planning/week-templates/[id].get'
import deleteWeekTemplateHandler from '../../server/api/v1/planning/week-templates/[id].delete'

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
  event.context.params = { id: 'tpl-1' }
  event.node.req.headers.cookie = `mp_planning_session=${SESSION_UUID}`
  return event
}

describe('legacy planning week-templates read/delete handlers (Planning Request Context)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/v1/planning/week-templates', () => {
    it('lists via unscoped listWeekTemplates', async () => {
      const rows = [{ id: 'a', name: 'One', updatedAt: '2026-01-01T00:00:00.000Z' }]
      mocks.listWeekTemplates.mockResolvedValue({ ok: true, value: rows })

      const event = makeEvent('trace-list')
      const out = await listWeekTemplatesHandler(event)

      expect(out).toEqual(rows)
      expect(mocks.listWeekTemplates).toHaveBeenCalledWith({})
    })

    it('logs and wraps unexpected failures with trace correlation', async () => {
      mocks.listWeekTemplates.mockRejectedValue(new Error('storage fault'))

      const event = makeEvent('trace-list-unexpected')
      const thrown = await listWeekTemplatesHandler(event).catch(e => e)

      expect(thrown).toMatchObject({
        statusCode: 500,
        statusMessage: 'The planner could not complete this request.',
      })
      expect(thrown.data?.errorId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )

      expect(vi.mocked(appLogger.withTag)).toHaveBeenCalledWith('planning-week-templates')
      const taggedLogger = vi.mocked(appLogger.withTag).mock.results[0]?.value as {
        error: ReturnType<typeof vi.fn>
      }
      expect(taggedLogger.error).toHaveBeenCalledWith(
        'planning.unexpected_error',
        expect.objectContaining({
          traceId: 'trace-list-unexpected',
          operation: 'list week templates',
          errorId: thrown.data?.errorId,
        }),
      )
    })
  })

  describe('GET /api/v1/planning/week-templates/:id', () => {
    it('loads via unscoped getWeekTemplateById', async () => {
      const body = emptyWeekPlan()
      const row = {
        id: 'tpl-1',
        name: 'One',
        body,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }
      mocks.getWeekTemplateById.mockResolvedValue({ ok: true, value: row })

      const event = makeEvent('trace-get')
      const out = await getWeekTemplateHandler(event)

      expect(out).toEqual(row)
      expect(mocks.getWeekTemplateById).toHaveBeenCalledWith({}, 'tpl-1')
    })

    it('passes through missing template id as 400', async () => {
      const event = makeEvent('trace-get-400')
      event.context.params = { id: '   ' }

      const thrown = await getWeekTemplateHandler(event).catch(e => e)

      expect(thrown).toMatchObject({ statusCode: 400, statusMessage: 'Template id is required.' })
      expect(mocks.getWeekTemplateById).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /api/v1/planning/week-templates/:id', () => {
    it('deletes via unscoped deleteWeekTemplate', async () => {
      mocks.deleteWeekTemplate.mockResolvedValue({ ok: true, value: { ok: true } })

      const event = makeEvent('trace-del')
      const out = await deleteWeekTemplateHandler(event)

      expect(out).toEqual({ ok: true })
      expect(mocks.deleteWeekTemplate).toHaveBeenCalledWith({}, 'tpl-1')
    })
  })
})
