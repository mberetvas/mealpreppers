/**
 * Handler-level coverage for the anonymous idle purge route:
 * verifies that the **Request Context Trace ID** (resolved by the trace middleware
 * and stored in `event.context.traceId`) is used for structured log correlation
 * rather than a raw `x-trace-id` header read, so **Trace Header Precedence**
 * remains owned by the middleware and is not duplicated in the Planning request path.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { appLogger } from '../../server/utils/logger'
import purgeHandler from '../../server/api/v1/internal/saved-weekplans/purge-idle-anonymous.post'

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
  purgeAnonymousIdleSavedWeekplans: vi.fn(),
  getSupabaseServerClient: vi.fn(() => ({})),
}))

vi.mock('../../server/db/supabaseClient', () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}))

vi.mock('../../server/services/planning/savedWeekplansRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/services/planning/savedWeekplansRepository')>()
  return {
    ...actual,
    purgeAnonymousIdleSavedWeekplans: mocks.purgeAnonymousIdleSavedWeekplans,
  }
})

const PURGE_SECRET = 'test-secret'
const AUTH_HEADER = `Bearer ${PURGE_SECRET}`

/**
 * Builds a minimal H3Event for the purge route.
 * `contextTraceId` is the **Request Context Trace ID** pre-set by the trace middleware.
 * `rawHeaderTraceId` simulates what `x-trace-id` would carry on the wire.
 * These may differ to verify the route reads from context, not raw headers.
 */
function makeEvent(opts: { contextTraceId?: string, rawHeaderTraceId?: string } = {}): H3Event {
  const socket = new Socket()
  const req = new IncomingMessage(socket)
  req.headers = {
    authorization: AUTH_HEADER,
    ...(opts.rawHeaderTraceId !== undefined ? { 'x-trace-id': opts.rawHeaderTraceId } : {}),
  }
  const res = new ServerResponse(req)
  const event = createEvent(req, res)
  if (opts.contextTraceId !== undefined) {
    (event.context as Record<string, unknown>).traceId = opts.contextTraceId
  }
  return event
}

describe('purge-idle-anonymous route — Request Context Trace ID propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('useRuntimeConfig', () => ({
      savedWeekplansIdlePurgeSecret: PURGE_SECRET,
    }))
  })

  it('uses the Request Context Trace ID from event.context for structured log entries', async () => {
    mocks.purgeAnonymousIdleSavedWeekplans.mockResolvedValue({ ok: true, value: { deleted: 3 } })

    const event = makeEvent({ contextTraceId: 'ctx-trace-purge' })
    await purgeHandler(event)

    const taggedLogger = vi.mocked(appLogger.withTag).mock.results[0]?.value as {
      info: ReturnType<typeof vi.fn>
    }
    const firstCall = taggedLogger.info.mock.calls[0] as [string, Record<string, unknown>]
    expect(firstCall[1]).toMatchObject({ traceId: 'ctx-trace-purge' })
  })

  it('uses context traceId even when x-trace-id header has a different value', async () => {
    mocks.purgeAnonymousIdleSavedWeekplans.mockResolvedValue({ ok: true, value: { deleted: 1 } })

    const event = makeEvent({
      contextTraceId: 'middleware-resolved-trace',
      rawHeaderTraceId: 'raw-header-trace',
    })
    await purgeHandler(event)

    const taggedLogger = vi.mocked(appLogger.withTag).mock.results[0]?.value as {
      info: ReturnType<typeof vi.fn>
    }
    const firstCall = taggedLogger.info.mock.calls[0] as [string, Record<string, unknown>]
    // Must use the middleware-resolved context value, NOT the raw header
    expect(firstCall[1]).toMatchObject({ traceId: 'middleware-resolved-trace' })
    expect(firstCall[1].traceId).not.toBe('raw-header-trace')
  })

  it('propagates the Request Context Trace ID into unexpected-error log entries', async () => {
    mocks.purgeAnonymousIdleSavedWeekplans.mockRejectedValue(new Error('db exploded'))

    const event = makeEvent({ contextTraceId: 'trace-purge-fail' })
    const thrown = await purgeHandler(event).catch(e => e)

    expect(thrown).toMatchObject({
      statusCode: 500,
      statusMessage: 'The planner could not complete this request.',
    })
    // handlePlanningUnexpected creates a second withTag call; use the last one
    const lastResult = vi.mocked(appLogger.withTag).mock.results.at(-1)
    const taggedLogger = lastResult?.value as { error: ReturnType<typeof vi.fn> }
    expect(taggedLogger.error).toHaveBeenCalledWith(
      'planning.unexpected_error',
      expect.objectContaining({ traceId: 'trace-purge-fail' }),
    )
  })
})
