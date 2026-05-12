import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { appLogger } from '../../server/utils/logger'
import {
  createPlanningRequestContext,
  withPlanningHandler,
} from '../../server/services/planning/planningRequestContext'

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

const SESSION_UUID = '550e8400-e29b-41d4-a716-446655440000'

/** Builds a minimal H3Event with optional traceId pre-set on context. */
function makeEvent(traceId?: string): H3Event {
  const socket = new Socket()
  const req = new IncomingMessage(socket)
  req.headers = {}
  const res = new ServerResponse(req)
  const event = createEvent(req, res)
  if (traceId !== undefined) {
    (event.context as Record<string, unknown>).traceId = traceId
  }
  return event
}

describe('createPlanningRequestContext', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resolves user principal when auth adapter returns a userId', async () => {
    const event = makeEvent('trace-abc')
    const adapter = vi.fn().mockResolvedValue('user-123')

    const ctx = await createPlanningRequestContext(event, { tag: 'test', operation: 'op' }, adapter)

    expect(ctx.principal).toEqual({ kind: 'user', userId: 'user-123' })
    expect(ctx.principalKind).toBe('user')
  })

  it('resolves anonymous principal when auth adapter returns null', async () => {
    const event = makeEvent('trace-abc')
    event.node.req.headers.cookie = `mp_planning_session=${SESSION_UUID}`
    const adapter = vi.fn().mockResolvedValue(null)

    const ctx = await createPlanningRequestContext(event, { tag: 'test', operation: 'op' }, adapter)

    expect(ctx.principal).toEqual({ kind: 'anonymous', sessionId: SESSION_UUID })
    expect(ctx.principalKind).toBe('anonymous')
  })

  it('exposes the Request Context Trace ID from the event', async () => {
    const event = makeEvent('trace-xyz')
    const adapter = vi.fn().mockResolvedValue('user-456')

    const ctx = await createPlanningRequestContext(event, { tag: 'test', operation: 'op' }, adapter)

    expect(ctx.traceId).toBe('trace-xyz')
  })

  it('exposes empty string when no traceId is set on event context', async () => {
    const event = makeEvent()
    const adapter = vi.fn().mockResolvedValue('user-789')

    const ctx = await createPlanningRequestContext(event, { tag: 'test', operation: 'op' }, adapter)

    expect(ctx.traceId).toBe('')
  })

  it('provides a StructuredLogger bound to the handler tag', async () => {
    const event = makeEvent('trace-abc')
    const adapter = vi.fn().mockResolvedValue('user-123')

    const ctx = await createPlanningRequestContext(event, { tag: 'my-handler', operation: 'op' }, adapter)

    expect(vi.mocked(appLogger.withTag)).toHaveBeenCalledWith('my-handler')
    expect(typeof ctx.logger.info).toBe('function')
    expect(typeof ctx.logger.error).toBe('function')
  })
})

describe('withPlanningHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes PlanningRequestContext alongside the event to the handler', async () => {
    const event = makeEvent('trace-abc')
    const adapter = vi.fn().mockResolvedValue('user-123')
    const fn = vi.fn().mockResolvedValue({ id: 'result-1' })

    const result = await withPlanningHandler({ tag: 'test', operation: 'op' }, fn, adapter)(event)

    expect(result).toEqual({ id: 'result-1' })
    const [calledEvent, ctx] = fn.mock.calls[0] as [H3Event, ReturnType<typeof fn.mock.calls[0][1]>]
    expect(calledEvent).toBe(event)
    expect(ctx.traceId).toBe('trace-abc')
    expect(ctx.principal).toEqual({ kind: 'user', userId: 'user-123' })
    expect(ctx.principalKind).toBe('user')
    expect(typeof ctx.logger.info).toBe('function')
  })

  it('passes expected H3 errors through unchanged', async () => {
    const event = makeEvent('trace-abc')
    event.node.req.headers.cookie = `mp_planning_session=${SESSION_UUID}`
    const adapter = vi.fn().mockResolvedValue(null)
    const h3Error = { statusCode: 404, statusMessage: 'Not found' }
    const fn = vi.fn().mockRejectedValue(h3Error)

    await expect(
      withPlanningHandler({ tag: 'test', operation: 'op' }, fn, adapter)(event),
    ).rejects.toBe(h3Error)
  })

  it('wraps unexpected failures as Planning 500 with an error identifier', async () => {
    const event = makeEvent('trace-unexpected')
    event.node.req.headers.cookie = `mp_planning_session=${SESSION_UUID}`
    const adapter = vi.fn().mockResolvedValue(null)
    const fn = vi.fn().mockRejectedValue(new Error('db exploded'))

    const thrown = await withPlanningHandler(
      { tag: 'test', operation: 'op' }, fn, adapter,
    )(event).catch(e => e)

    expect(thrown).toMatchObject({
      statusCode: 500,
      statusMessage: 'The planner could not complete this request.',
    })
    expect(thrown.data?.errorId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('logs unexpected failures with trace correlation and the error identifier', async () => {
    const event = makeEvent('trace-unexpected')
    event.node.req.headers.cookie = `mp_planning_session=${SESSION_UUID}`
    const adapter = vi.fn().mockResolvedValue(null)
    const fn = vi.fn().mockRejectedValue(new Error('db exploded'))

    const thrown = await withPlanningHandler(
      { tag: 'test', operation: 'op' }, fn, adapter,
    )(event).catch(e => e)

    const taggedLogger = vi.mocked(appLogger.withTag).mock.results[0]?.value as {
      error: ReturnType<typeof vi.fn>
    }
    expect(taggedLogger.error).toHaveBeenCalledWith(
      'planning.unexpected_error',
      expect.objectContaining({
        traceId: 'trace-unexpected',
        operation: 'op',
        errorId: thrown.data?.errorId,
      }),
    )
  })
})
