import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'

/**
 * Creates a minimal H3Event with request headers for end-to-end middleware logging tests.
 * Pre-sets an empty rawBody on the IncomingMessage so H3's body caching returns immediately
 * without waiting on the underlying socket stream.
 */
function makeEvent(
  headers: Record<string, string> = {},
  url = '/api/recipes?draft=true',
  method = 'POST',
  rawBody: Buffer = Buffer.from(''),
) {
  const socket = new Socket()
  const req = new IncomingMessage(socket)
  req.headers = { host: 'mealprepper.test', ...headers }
  req.url = url
  req.method = method
  ;(req as unknown as Record<string, unknown>).rawBody = rawBody
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
    const { default: requestDiagnostics } = await import('../../server/middleware/03.request-diagnostics')

    const event = makeEvent({
      'x-trace-id': 'trace-preferred',
      'x-request-id': 'request-fallback',
    })

    await traceContext(event)
    await requestDiagnostics(event)

    event.node.res.statusCode = 201
    event.node.res.emit('finish')

    const entries = parseLogEntries(stdoutOutput)
    const handledEntry = entries.find((e) => e.message === 'http.request_handled')

    expect(event.context.traceId).toBe('trace-preferred')
    expect(event.node.res.getHeader('x-trace-id')).toBe('trace-preferred')
    expect(handledEntry).toMatchObject({
      message: 'http.request_handled',
      data: {
        method: 'POST',
        path: '/api/recipes',
        statusCode: 201,
        traceId: 'trace-preferred',
      },
    })
    expect(typeof (handledEntry?.data as Record<string, unknown>).duration).toBe('number')
  })

  it('emits diagnostics when LOG_LEVEL is absent outside production (defaults to debug)', async () => {
    delete process.env.LOG_LEVEL
    process.env.NODE_ENV = 'development'
    vi.resetModules()

    const { default: traceContext } = await import('../../server/middleware/01.trace-context')
    const { default: requestDiagnostics } = await import('../../server/middleware/03.request-diagnostics')

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
    const { default: requestDiagnostics } = await import('../../server/middleware/03.request-diagnostics')

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
    const { default: requestDiagnostics } = await import('../../server/middleware/03.request-diagnostics')

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
    const { default: requestDiagnostics } = await import('../../server/middleware/03.request-diagnostics')

    const event = makeEvent({ 'x-request-id': 'req-fallback-id' })
    await traceContext(event)
    await requestDiagnostics(event)
    event.node.res.statusCode = 200
    event.node.res.emit('finish')

    const entries = parseLogEntries(stdoutOutput)
    // Both request_started and request_handled carry the same traceId
    expect(entries.every((e) => (e?.data as Record<string, unknown>).traceId === 'req-fallback-id')).toBe(true)
  })
})

describe('Logging V2 integration — http.request_started (DEBUG)', () => {
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

  it('emits request_started before request_handled on finish', async () => {
    const { default: traceContext } = await import('../../server/middleware/01.trace-context')
    const { default: requestDiagnostics } = await import('../../server/middleware/03.request-diagnostics')

    const event = makeEvent({ 'x-trace-id': 'trace-order' }, '/api/recipes', 'GET')
    await traceContext(event)
    await requestDiagnostics(event)
    event.node.res.statusCode = 200
    event.node.res.emit('finish')

    const entries = parseLogEntries(stdoutOutput)
    expect(entries[0]?.message).toBe('http.request_started')
    expect(entries[1]?.message).toBe('http.request_handled')
  })

  it('request_started carries method, path, traceId, and request_headers', async () => {
    const { default: traceContext } = await import('../../server/middleware/01.trace-context')
    const { default: requestDiagnostics } = await import('../../server/middleware/03.request-diagnostics')

    const event = makeEvent(
      { 'x-trace-id': 'trace-meta', 'content-type': 'application/json' },
      '/api/recipes',
      'GET',
    )
    await traceContext(event)
    await requestDiagnostics(event)
    event.node.res.emit('finish')

    const entries = parseLogEntries(stdoutOutput)
    const started = entries.find((e) => e.message === 'http.request_started')
    expect(started).toBeDefined()
    const data = started?.data as Record<string, unknown>
    expect(data.method).toBe('GET')
    expect(data.path).toBe('/api/recipes')
    expect(data.traceId).toBe('trace-meta')
    expect(data.request_headers).toBeDefined()
  })

  it('redacts authorization header in request_started', async () => {
    const { default: traceContext } = await import('../../server/middleware/01.trace-context')
    const { default: requestDiagnostics } = await import('../../server/middleware/03.request-diagnostics')

    const event = makeEvent(
      { 'x-trace-id': 'trace-redact', authorization: 'Bearer secret-token' },
      '/api/recipes',
      'GET',
    )
    await traceContext(event)
    await requestDiagnostics(event)
    event.node.res.emit('finish')

    const entries = parseLogEntries(stdoutOutput)
    const started = entries.find((e) => e.message === 'http.request_started')
    const headers = (started?.data as Record<string, unknown>).request_headers as Record<
      string,
      unknown
    >
    expect(headers.authorization).toBe('[REDACTED]')
  })

  it('sanitizes a URL-shaped target_url query param in request_started', async () => {
    const { default: traceContext } = await import('../../server/middleware/01.trace-context')
    const { default: requestDiagnostics } = await import('../../server/middleware/03.request-diagnostics')

    const event = makeEvent(
      { 'x-trace-id': 'trace-url' },
      '/api/proxy?target_url=https%3A%2F%2Fuser%3Apass%40example.com%2Fpath%3Fq%3Dsecret',
      'GET',
    )
    await traceContext(event)
    await requestDiagnostics(event)
    event.node.res.emit('finish')

    const entries = parseLogEntries(stdoutOutput)
    const started = entries.find((e) => e.message === 'http.request_started')
    const params = (started?.data as Record<string, unknown>).query_params as Record<string, unknown>
    expect(params.target_url).toBe('https://example.com/path')
  })

  it('includes json_key_count in request_started for a JSON POST body', async () => {
    const body = Buffer.from(JSON.stringify({ title: 'Pasta', servings: 4, tags: ['quick'] }))
    const { default: traceContext } = await import('../../server/middleware/01.trace-context')
    const { default: requestDiagnostics } = await import('../../server/middleware/03.request-diagnostics')

    const event = makeEvent(
      { 'x-trace-id': 'trace-json', 'content-type': 'application/json' },
      '/api/recipes',
      'POST',
      body,
    )
    await traceContext(event)
    await requestDiagnostics(event)
    event.node.res.emit('finish')

    const entries = parseLogEntries(stdoutOutput)
    const started = entries.find((e) => e.message === 'http.request_started')
    const data = started?.data as Record<string, unknown>
    expect(data.json_key_count).toBe(3)
    expect(data.request_body_size).toBe(body.byteLength)
    expect(data.request_content_type).toBe('application/json')
  })

  it('sets structure_parse_skipped for a body over 1 MiB', async () => {
    const bigBody = Buffer.alloc(1024 * 1024 + 1)
    const { default: traceContext } = await import('../../server/middleware/01.trace-context')
    const { default: requestDiagnostics } = await import('../../server/middleware/03.request-diagnostics')

    const event = makeEvent(
      { 'x-trace-id': 'trace-big', 'content-type': 'application/json' },
      '/api/recipes',
      'POST',
      bigBody,
    )
    await traceContext(event)
    await requestDiagnostics(event)
    event.node.res.emit('finish')

    const entries = parseLogEntries(stdoutOutput)
    const started = entries.find((e) => e.message === 'http.request_started')
    const data = started?.data as Record<string, unknown>
    expect(data.structure_parse_skipped).toBe(true)
    expect(data.request_body_size).toBe(bigBody.byteLength)
    expect(data).not.toHaveProperty('json_key_count')
  })

  it('does not emit request_started when LOG_LEVEL is info', async () => {
    process.env.LOG_LEVEL = 'info'
    vi.resetModules()

    const { default: traceContext } = await import('../../server/middleware/01.trace-context')
    const { default: requestDiagnostics } = await import('../../server/middleware/03.request-diagnostics')

    const event = makeEvent({ 'x-trace-id': 'trace-no-debug' })
    await traceContext(event)
    await requestDiagnostics(event)
    event.node.res.emit('finish')

    const entries = parseLogEntries(stdoutOutput)
    expect(entries.some((e) => e.message === 'http.request_started')).toBe(false)
  })
})

describe('Logging V2 integration — request_completed (INFO)', () => {
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

  it('emits exactly one INFO request_completed with required fields for a non-health route', async () => {
    process.env.LOG_LEVEL = 'info'
    vi.resetModules()

    const { default: traceContext } = await import('../../server/middleware/01.trace-context')
    const { default: requestCompleted } = await import('../../server/middleware/04.request-completed')

    const event = makeEvent({ 'x-trace-id': 'trace-info-test' }, '/api/recipes', 'GET')
    await traceContext(event)
    await requestCompleted(event)

    event.node.res.statusCode = 200
    event.node.res.emit('finish')

    const entries = parseLogEntries(stdoutOutput)
    const completedEntries = entries.filter((e) => e.message === 'http.request_completed')
    expect(completedEntries).toHaveLength(1)

    const data = completedEntries[0]?.data as Record<string, unknown>
    expect(data.method).toBe('GET')
    expect(data.path).toBe('/api/recipes')
    expect(data.status_code).toBe(200)
    expect(typeof data.latency_ms).toBe('number')
    expect(data.traceId).toBe('trace-info-test')
  })

  it('merges trace_id from upstream trace-context middleware into the completion event', async () => {
    process.env.LOG_LEVEL = 'info'
    vi.resetModules()

    const { default: traceContext } = await import('../../server/middleware/01.trace-context')
    const { default: requestCompleted } = await import('../../server/middleware/04.request-completed')

    const event = makeEvent({ 'x-trace-id': 'trace-merged' }, '/api/plans', 'POST')
    await traceContext(event)
    await requestCompleted(event)

    event.node.res.statusCode = 201
    event.node.res.emit('finish')

    const [logEntry] = parseLogEntries(stdoutOutput)
    expect(logEntry?.message).toBe('http.request_completed')
    expect((logEntry?.data as Record<string, unknown>).traceId).toBe('trace-merged')
  })

  it('produces no INFO request_completed for GET /health', async () => {
    process.env.LOG_LEVEL = 'info'
    vi.resetModules()

    const { default: traceContext } = await import('../../server/middleware/01.trace-context')
    const { default: requestCompleted } = await import('../../server/middleware/04.request-completed')

    const event = makeEvent({}, '/health', 'GET')
    await traceContext(event)
    await requestCompleted(event)

    event.node.res.statusCode = 200
    event.node.res.emit('finish')

    const entries = parseLogEntries(stdoutOutput)
    expect(entries.some((e) => e.message === 'http.request_completed')).toBe(false)
  })

  it('produces no INFO request_completed when log level is debug', async () => {
    process.env.LOG_LEVEL = 'debug'
    vi.resetModules()

    const { default: traceContext } = await import('../../server/middleware/01.trace-context')
    const { default: requestCompleted } = await import('../../server/middleware/04.request-completed')

    const event = makeEvent({ 'x-trace-id': 'trace-debug' }, '/api/recipes', 'GET')
    await traceContext(event)
    await requestCompleted(event)

    event.node.res.statusCode = 200
    event.node.res.emit('finish')

    const entries = parseLogEntries(stdoutOutput)
    expect(entries.some((e) => e.message === 'http.request_completed')).toBe(false)
  })

  it('includes user_agent from request header in the completion event', async () => {
    process.env.LOG_LEVEL = 'info'
    vi.resetModules()

    const { default: traceContext } = await import('../../server/middleware/01.trace-context')
    const { default: requestCompleted } = await import('../../server/middleware/04.request-completed')

    const event = makeEvent(
      { 'x-trace-id': 'trace-ua', 'user-agent': 'IntegrationBot/2.0' },
      '/api/recipes',
      'GET',
    )
    await traceContext(event)
    await requestCompleted(event)

    event.node.res.statusCode = 200
    event.node.res.emit('finish')

    const [logEntry] = parseLogEntries(stdoutOutput)
    expect((logEntry?.data as Record<string, unknown>).user_agent).toBe('IntegrationBot/2.0')
  })
})
