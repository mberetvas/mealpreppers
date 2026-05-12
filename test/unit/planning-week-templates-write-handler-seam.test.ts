/**
 * Legacy week-template write routes adopt `withPlanningHandler` while keeping unscoped repository calls.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { emptyWeekPlan } from '../../utils/weekPlan'
import { createEvent } from 'h3'
import { appLogger } from '../../server/utils/logger'
import postWeekTemplateHandler from '../../server/api/v1/planning/week-templates/index.post'
import patchWeekTemplateHandler from '../../server/api/v1/planning/week-templates/[id].patch'

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
  createWeekTemplate: vi.fn(),
  updateWeekTemplate: vi.fn(),
  assertRecipeIdsExist: vi.fn(),
  getSupabaseServerClient: vi.fn(() => ({})),
}))

vi.mock('../../server/db/supabaseClient', () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}))

vi.mock('../../server/services/planning/planningRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/services/planning/planningRepository')>()
  return {
    ...actual,
    createWeekTemplate: mocks.createWeekTemplate,
    updateWeekTemplate: mocks.updateWeekTemplate,
    assertRecipeIdsExist: mocks.assertRecipeIdsExist,
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
  event.context.params = { id: 'tpl-1' }
  event.node.req.headers.cookie = `mp_planning_session=${SESSION_UUID}`
  return event
}

describe('legacy planning week-templates write handlers (Planning Request Context)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.assertRecipeIdsExist.mockResolvedValue({ ok: true, value: undefined })
  })

  describe('POST /api/v1/planning/week-templates', () => {
    it('creates via unscoped createWeekTemplate and returns the row', async () => {
      const body = emptyWeekPlan()
      h3Mocks.readBody.mockResolvedValue({ name: 'My plan', body })
      const row = {
        id: 'new-id',
        name: 'My plan',
        body,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }
      mocks.createWeekTemplate.mockResolvedValue({ ok: true, value: row })

      const event = makeEvent('trace-post')
      const out = await postWeekTemplateHandler(event)

      expect(out).toEqual(row)
      expect(mocks.createWeekTemplate).toHaveBeenCalledWith(
        {},
        { name: 'My plan', body },
      )
    })

    it('passes through validation errors without wrapping as unexpected', async () => {
      h3Mocks.readBody.mockResolvedValue({})

      const event = makeEvent('trace-post-400')
      const thrown = await postWeekTemplateHandler(event).catch(e => e)

      expect(thrown).toMatchObject({ statusCode: 400, statusMessage: 'Invalid week template payload.' })
      expect(mocks.createWeekTemplate).not.toHaveBeenCalled()
    })

    it('wraps unexpected failures from createWeekTemplate with Planning 500', async () => {
      const body = emptyWeekPlan()
      h3Mocks.readBody.mockResolvedValue({ name: 'X', body })
      mocks.createWeekTemplate.mockRejectedValue(new Error('db'))

      const event = makeEvent('trace-post-500')
      const thrown = await postWeekTemplateHandler(event).catch(e => e)

      expect(thrown).toMatchObject({
        statusCode: 500,
        statusMessage: 'The planner could not complete this request.',
      })

      const taggedLogger = vi.mocked(appLogger.withTag).mock.results[0]?.value as {
        error: ReturnType<typeof vi.fn>
      }
      expect(vi.mocked(appLogger.withTag)).toHaveBeenCalledWith('planning-week-templates')
      expect(taggedLogger.error).toHaveBeenCalledWith(
        'planning.unexpected_error',
        expect.objectContaining({
          traceId: 'trace-post-500',
          operation: 'create week template',
        }),
      )
    })
  })

  describe('PATCH /api/v1/planning/week-templates/:id', () => {
    beforeEach(() => {
      h3Mocks.readBody.mockResolvedValue({ name: 'Renamed' })
    })

    it('updates via unscoped updateWeekTemplate and returns the row', async () => {
      const row = {
        id: 'tpl-1',
        name: 'Renamed',
        body: emptyWeekPlan(),
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      }
      mocks.updateWeekTemplate.mockResolvedValue({ ok: true, value: row })

      const event = makeEvent('trace-patch')
      const out = await patchWeekTemplateHandler(event)

      expect(out).toEqual(row)
      expect(mocks.updateWeekTemplate).toHaveBeenCalledWith(
        {},
        'tpl-1',
        { name: 'Renamed' },
      )
    })

    it('passes through missing id without wrapping as unexpected', async () => {
      const event = makeEvent('trace-patch-400')
      event.context.params = { id: '   ' }

      const thrown = await patchWeekTemplateHandler(event).catch(e => e)

      expect(thrown).toMatchObject({ statusCode: 400, statusMessage: 'Template id is required.' })
      expect(mocks.updateWeekTemplate).not.toHaveBeenCalled()
    })

    it('wraps unexpected failures from updateWeekTemplate with Planning 500', async () => {
      mocks.updateWeekTemplate.mockRejectedValue(new Error('db'))

      const event = makeEvent('trace-patch-500')
      const thrown = await patchWeekTemplateHandler(event).catch(e => e)

      expect(thrown).toMatchObject({
        statusCode: 500,
        statusMessage: 'The planner could not complete this request.',
      })

      const taggedLogger = vi.mocked(appLogger.withTag).mock.results[0]?.value as {
        error: ReturnType<typeof vi.fn>
      }
      expect(vi.mocked(appLogger.withTag)).toHaveBeenCalledWith('planning-week-templates')
      expect(taggedLogger.error).toHaveBeenCalledWith(
        'planning.unexpected_error',
        expect.objectContaining({
          traceId: 'trace-patch-500',
          operation: 'patch week template',
        }),
      )
    })
  })
})
