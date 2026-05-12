import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'

/** Creates a minimal H3Event with request headers for end-to-end middleware logging tests. */
function makeEvent(
  headers: Record<string, string> = {},
  url = '/api/recipes?draft=true',
  method = 'POST',
) {
  const socket = new Socket()
  const req = new IncomingMessage(socket)
  req.headers = { host: 'mealprepper.test', ...headers }
  req.url = url
  req.method = method
  const res = new ServerResponse(req)
  return createEvent(req, res)
}

/** Parses newline-delimited JSON log output into plain objects. */
function parseLogEntries(output: string): Array<Record<string, unknown>> {
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
}

describe('Logging V2 integration', () => {
  let stdoutOutput: string
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let originalLogLevel: string | undefined
  let originalLogJson: string | undefined
  let originalNodeEnv: string | undefined

  beforeEach(() => {
    stdoutOutput = ''
    originalLogLevel = process.env.LOG_LEVEL
    originalLogJson = process.env.LOG_JSON
    originalNodeEnv = process.env.NODE_ENV
    process.env.LOG_LEVEL = 'debug'
    process.env.LOG_JSON = 'true'
    process.env.NODE_ENV = 'test'
    vi.resetModules()
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutOutput += String(chunk)
      return true
    })
  })

  afterEach(() => {
    stdoutSpy.mockRestore()
    if (originalLogLevel === undefined) delete process.env.LOG_LEVEL
    else process.env.LOG_LEVEL = originalLogLevel
    if (originalLogJson === undefined) delete process.env.LOG_JSON
    else process.env.LOG_JSON = originalLogJson
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    vi.resetModules()
  })

  it('propagates the preferred trace header into request-handled logs', async () => {
    const { default: traceContext } = await import('../../server/middleware/01.trace-context')
    const { default: requestDiagnostics } = await import('../../server/middleware/02.request-diagnostics')

    const event = makeEvent({
      'x-trace-id': 'trace-preferred',
      'x-request-id': 'request-fallback',
    })

    await traceContext(event)
    await requestDiagnostics(event)

    event.node.res.statusCode = 201
    event.node.res.emit('finish')

    const [logEntry] = parseLogEntries(stdoutOutput)

    expect(event.context.traceId).toBe('trace-preferred')
    expect(event.node.res.getHeader('x-trace-id')).toBe('trace-preferred')
    expect(logEntry).toMatchObject({
      message: 'http.request_handled',
      data: {
        method: 'POST',
        path: '/api/recipes',
        statusCode: 201,
        traceId: 'trace-preferred',
      },
    })
    expect(typeof (logEntry?.data as Record<string, unknown>).duration).toBe('number')
  })

  it('emits diagnostics when LOG_LEVEL is absent outside production (defaults to debug)', async () => {
    delete process.env.LOG_LEVEL
    process.env.NODE_ENV = 'development'
    vi.resetModules()

    const { default: traceContext } = await import('../../server/middleware/01.trace-context')
    const { default: requestDiagnostics } = await import('../../server/middleware/02.request-diagnostics')

    const event = makeEvent({ 'x-trace-id': 'trace-absent' })
    await traceContext(event)
    await requestDiagnostics(event)
    event.node.res.statusCode = 200
    event.node.res.emit('finish')

    const entries = parseLogEntries(stdoutOutput)
    expect(entries.some((e) => e.message === 'http.request_handled')).toBe(true)
  })

  it('emits diagnostics when LOG_LEVEL is invalid outside production (falls back to debug)', async () => {
    process.env.LOG_LEVEL = 'verbose'
    process.env.NODE_ENV = 'development'
    vi.resetModules()

    const { default: traceContext } = await import('../../server/middleware/01.trace-context')
    const { default: requestDiagnostics } = await import('../../server/middleware/02.request-diagnostics')

    const event = makeEvent({ 'x-trace-id': 'trace-invalid' })
    await traceContext(event)
    await requestDiagnostics(event)
    event.node.res.statusCode = 200
    event.node.res.emit('finish')

    const entries = parseLogEntries(stdoutOutput)
    expect(entries.some((e) => e.message === 'http.request_handled')).toBe(true)
  })

  it('suppresses diagnostics when effective LOG_LEVEL is info', async () => {
    process.env.LOG_LEVEL = 'info'
    vi.resetModules()

    const { default: traceContext } = await import('../../server/middleware/01.trace-context')
    const { default: requestDiagnostics } = await import('../../server/middleware/02.request-diagnostics')

    const event = makeEvent({ 'x-trace-id': 'trace-info' })
    await traceContext(event)
    await requestDiagnostics(event)
    event.node.res.statusCode = 200
    event.node.res.emit('finish')

    const entries = parseLogEntries(stdoutOutput)
    expect(entries.some((e) => e.message === 'http.request_handled')).toBe(false)
  })

  it('includes trace ID from fallback x-request-id header in diagnostics', async () => {
    const { default: traceContext } = await import('../../server/middleware/01.trace-context')
    const { default: requestDiagnostics } = await import('../../server/middleware/02.request-diagnostics')

    const event = makeEvent({ 'x-request-id': 'req-fallback-id' })
    await traceContext(event)
    await requestDiagnostics(event)
    event.node.res.statusCode = 200
    event.node.res.emit('finish')

    const [logEntry] = parseLogEntries(stdoutOutput)
    expect((logEntry?.data as Record<string, unknown>).traceId).toBe('req-fallback-id')
  })
})
