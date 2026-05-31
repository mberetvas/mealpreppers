import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import type { LogLevelName } from '../../server/utils/logger'

/** Controls the resolved log level exposed by the logger mock. */
let mockLogLevel: LogLevelName = 'info'

vi.mock('../../server/utils/logger', () => ({
  appLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withTag: vi.fn(function () {
      return this
    }),
  },
  get logConfig() {
    return { level: mockLogLevel, json: false, nodeEnv: 'test' }
  },
}))

/** Creates a minimal H3Event for unit testing with configurable URL, method, and headers. */
function makeEvent(url = '/api/recipes', method = 'GET', headers: Record<string, string> = {}) {
  const socket = new Socket()
  const req = new IncomingMessage(socket)
  req.url = url
  req.method = method
  req.headers = { host: 'mealprepper.test', ...headers }
  const res = new ServerResponse(req)
  return createEvent(req, res)
}

describe('request-completed middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLogLevel = 'info'
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('emits INFO request_completed for a normal route at info log level', async () => {
    mockLogLevel = 'info'
    const { default: middleware } = await import('../../server/middleware/03.request-completed')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent('/api/recipes', 'GET')
    event.context.traceId = 'trace-abc'
    await middleware(event)

    event.node.res.statusCode = 200
    event.node.res.emit('finish')

    expect(appLogger.info).toHaveBeenCalledOnce()
    const [message, data] = (appLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(message).toBe('http.request_completed')
    expect(data).toMatchObject({
      method: 'GET',
      path: '/api/recipes',
      status_code: 200,
      traceId: 'trace-abc',
    })
    expect(typeof data.latency_ms).toBe('number')
    expect(data.latency_ms).toBeGreaterThanOrEqual(0)
  })

  it('emits INFO request_completed for a POST route', async () => {
    const { default: middleware } = await import('../../server/middleware/03.request-completed')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent('/api/recipes', 'POST')
    await middleware(event)

    event.node.res.statusCode = 201
    event.node.res.emit('finish')

    const [message, data] = (appLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(message).toBe('http.request_completed')
    expect(data.method).toBe('POST')
    expect(data.status_code).toBe(201)
  })

  it('does NOT emit INFO request_completed for GET /health', async () => {
    const { default: middleware } = await import('../../server/middleware/03.request-completed')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent('/health', 'GET')
    await middleware(event)
    event.node.res.emit('finish')

    expect(appLogger.info).not.toHaveBeenCalled()
  })

  it('does NOT emit INFO when log level is debug', async () => {
    mockLogLevel = 'debug'
    const { default: middleware } = await import('../../server/middleware/03.request-completed')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent('/api/recipes', 'GET')
    await middleware(event)
    event.node.res.emit('finish')

    expect(appLogger.info).not.toHaveBeenCalled()
  })

  it('does emit INFO when log level is warn', async () => {
    mockLogLevel = 'warn'
    const { default: middleware } = await import('../../server/middleware/03.request-completed')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent('/api/recipes', 'GET')
    await middleware(event)
    event.node.res.emit('finish')

    expect(appLogger.info).toHaveBeenCalledOnce()
  })

  it('does emit INFO when log level is error', async () => {
    mockLogLevel = 'error'
    const { default: middleware } = await import('../../server/middleware/03.request-completed')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent('/api/recipes', 'GET')
    await middleware(event)
    event.node.res.emit('finish')

    expect(appLogger.info).toHaveBeenCalledOnce()
  })

  it('uses only the pathname, not query string', async () => {
    const { default: middleware } = await import('../../server/middleware/03.request-completed')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent('/api/search?q=pasta&limit=10', 'GET')
    await middleware(event)
    event.node.res.emit('finish')

    const [, data] = (appLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(data.path).toBe('/api/search')
    expect(data.path).not.toContain('?')
  })

  it('includes trace_id from event context when set by trace-context middleware', async () => {
    const { default: middleware } = await import('../../server/middleware/03.request-completed')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent('/api/recipes', 'POST')
    event.context.traceId = 'trace-from-middleware'
    await middleware(event)
    event.node.res.emit('finish')

    const [, data] = (appLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(data.traceId).toBe('trace-from-middleware')
  })

  it('uses empty traceId when event context has no traceId', async () => {
    const { default: middleware } = await import('../../server/middleware/03.request-completed')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent()
    await middleware(event)
    event.node.res.emit('finish')

    const [, data] = (appLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(data.traceId).toBe('')
  })

  it('includes user_agent when User-Agent header is present', async () => {
    const { default: middleware } = await import('../../server/middleware/03.request-completed')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent('/api/recipes', 'GET', { 'user-agent': 'TestBot/1.0' })
    await middleware(event)
    event.node.res.emit('finish')

    const [, data] = (appLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(data.user_agent).toBe('TestBot/1.0')
  })

  it('omits user_agent when User-Agent header is absent', async () => {
    const { default: middleware } = await import('../../server/middleware/03.request-completed')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent('/api/recipes', 'GET')
    await middleware(event)
    event.node.res.emit('finish')

    const [, data] = (appLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(data).not.toHaveProperty('user_agent')
  })

  it('emits exactly one INFO event per request (not multiple)', async () => {
    const { default: middleware } = await import('../../server/middleware/03.request-completed')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent('/api/recipes', 'GET')
    await middleware(event)
    event.node.res.emit('finish')
    event.node.res.emit('finish')

    expect(appLogger.info).toHaveBeenCalledOnce()
  })

  it('context from request A does not leak into request B', async () => {
    const { default: middleware } = await import('../../server/middleware/03.request-completed')
    const { appLogger } = await import('../../server/utils/logger')

    const eventA = makeEvent('/api/recipes', 'GET')
    eventA.context.traceId = 'trace-A'
    await middleware(eventA)
    eventA.node.res.statusCode = 200
    eventA.node.res.emit('finish')

    vi.clearAllMocks()

    const eventB = makeEvent('/api/plans', 'POST')
    eventB.context.traceId = 'trace-B'
    await middleware(eventB)
    eventB.node.res.statusCode = 201
    eventB.node.res.emit('finish')

    const [, dataB] = (appLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(dataB.traceId).toBe('trace-B')
    expect(dataB.method).toBe('POST')
    expect(dataB.path).toBe('/api/plans')
    expect(dataB.status_code).toBe(201)
  })

  it('does not POST /health emit INFO — only GET /health is excluded from INFO', async () => {
    const { default: middleware } = await import('../../server/middleware/03.request-completed')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent('/health', 'POST')
    await middleware(event)
    event.node.res.emit('finish')

    expect(appLogger.info).toHaveBeenCalledOnce()
  })

  it('does not include request or response body in the log entry', async () => {
    const { default: middleware } = await import('../../server/middleware/03.request-completed')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent('/api/recipes', 'POST')
    await middleware(event)
    event.node.res.emit('finish')

    const [, data] = (appLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(data).not.toHaveProperty('body')
    expect(data).not.toHaveProperty('requestBody')
    expect(data).not.toHaveProperty('responseBody')
  })
})
