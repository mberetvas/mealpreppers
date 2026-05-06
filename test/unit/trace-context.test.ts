import { describe, expect, it } from 'vitest'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { useTraceId } from '../../server/middleware/01.trace-context'

/**
 * Creates a minimal H3Event for unit testing by wiring up bare-bones
 * IncomingMessage / ServerResponse instances without a live HTTP server.
 */
function makeEvent(headers: Record<string, string> = {}): ReturnType<typeof createEvent> {
  const socket = new Socket()
  const req = new IncomingMessage(socket)
  req.headers = headers
  const res = new ServerResponse(req)
  return createEvent(req, res)
}

describe('trace-context middleware', () => {
  it('uses x-trace-id header when present', async () => {
    const { default: middleware } = await import('../../server/middleware/01.trace-context')
    const event = makeEvent({ 'x-trace-id': 'trace-abc' })
    await middleware(event)
    expect(event.context.traceId).toBe('trace-abc')
  })

  it('falls back to x-request-id when x-trace-id is absent', async () => {
    const { default: middleware } = await import('../../server/middleware/01.trace-context')
    const event = makeEvent({ 'x-request-id': 'req-xyz' })
    await middleware(event)
    expect(event.context.traceId).toBe('req-xyz')
  })

  it('prefers x-trace-id over x-request-id', async () => {
    const { default: middleware } = await import('../../server/middleware/01.trace-context')
    const event = makeEvent({ 'x-trace-id': 'trace-abc', 'x-request-id': 'req-xyz' })
    await middleware(event)
    expect(event.context.traceId).toBe('trace-abc')
  })

  it('generates a UUID when no headers are present', async () => {
    const { default: middleware } = await import('../../server/middleware/01.trace-context')
    const event = makeEvent()
    await middleware(event)
    expect(event.context.traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('treats empty x-trace-id as missing and falls back to x-request-id', async () => {
    const { default: middleware } = await import('../../server/middleware/01.trace-context')
    const event = makeEvent({ 'x-trace-id': '', 'x-request-id': 'req-fallback' })
    await middleware(event)
    expect(event.context.traceId).toBe('req-fallback')
  })

  it('treats empty x-request-id as missing and generates a UUID', async () => {
    const { default: middleware } = await import('../../server/middleware/01.trace-context')
    const event = makeEvent({ 'x-trace-id': '', 'x-request-id': '' })
    await middleware(event)
    expect(event.context.traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('sets the x-trace-id response header', async () => {
    const { default: middleware } = await import('../../server/middleware/01.trace-context')
    const event = makeEvent({ 'x-trace-id': 'trace-abc' })
    await middleware(event)
    expect(event.node.res.getHeader('x-trace-id')).toBe('trace-abc')
  })
})

describe('useTraceId', () => {
  it('returns traceId from event context', async () => {
    const { default: middleware } = await import('../../server/middleware/01.trace-context')
    const event = makeEvent({ 'x-trace-id': 'trace-123' })
    await middleware(event)
    expect(useTraceId(event)).toBe('trace-123')
  })

  it('returns empty string when context has no traceId', () => {
    const event = makeEvent()
    expect(useTraceId(event)).toBe('')
  })
})
