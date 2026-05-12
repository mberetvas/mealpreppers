import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import type { LogLevelName } from '../../server/utils/logger'

/** Controls the resolved log level exposed by the logger mock. */
let mockLogLevel: LogLevelName = 'debug'

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

/** Creates a minimal H3Event for unit testing with configurable URL and method. */
function makeEvent(url = '/api/test', method = 'GET') {
  const socket = new Socket()
  const req = new IncomingMessage(socket)
  req.url = url
  req.method = method
  req.headers = { host: 'mealprepper.test' }
  const res = new ServerResponse(req)
  return createEvent(req, res)
}

describe('request-diagnostics middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLogLevel = 'debug'
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('does not emit when resolved log level is info', async () => {
    mockLogLevel = 'info'
    const { default: middleware } = await import('../../server/middleware/02.request-diagnostics')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent()
    await middleware(event)
    event.node.res.emit('finish')

    expect(appLogger.debug).not.toHaveBeenCalled()
  })

  it('does not emit when resolved log level is warn', async () => {
    mockLogLevel = 'warn'
    const { default: middleware } = await import('../../server/middleware/02.request-diagnostics')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent()
    await middleware(event)
    event.node.res.emit('finish')

    expect(appLogger.debug).not.toHaveBeenCalled()
  })

  it('does not emit when resolved log level is error', async () => {
    mockLogLevel = 'error'
    const { default: middleware } = await import('../../server/middleware/02.request-diagnostics')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent()
    await middleware(event)
    event.node.res.emit('finish')

    expect(appLogger.debug).not.toHaveBeenCalled()
  })

  it('emits when resolved log level is debug regardless of LOG_LEVEL env var', async () => {
    mockLogLevel = 'debug'
    delete process.env.LOG_LEVEL
    const { default: middleware } = await import('../../server/middleware/02.request-diagnostics')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent('/api/recipes', 'POST')
    event.context.traceId = 'trace-abc'
    await middleware(event)

    event.node.res.statusCode = 201
    event.node.res.emit('finish')

    expect(appLogger.debug).toHaveBeenCalledOnce()
    const [message, data] = (appLogger.debug as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(message).toBe('http.request_handled')
    expect(data).toMatchObject({
      method: 'POST',
      path: '/api/recipes',
      statusCode: 201,
      traceId: 'trace-abc',
    })
    expect(typeof data.duration).toBe('number')
    expect(data.duration).toBeGreaterThanOrEqual(0)
  })

  it('captures the correct HTTP method', async () => {
    const { default: middleware } = await import('../../server/middleware/02.request-diagnostics')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent('/api/meals', 'DELETE')
    await middleware(event)
    event.node.res.statusCode = 204
    event.node.res.emit('finish')

    const [, data] = (appLogger.debug as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(data.method).toBe('DELETE')
  })

  it('uses only the pathname, not query string', async () => {
    const { default: middleware } = await import('../../server/middleware/02.request-diagnostics')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent('/api/search?q=pasta&limit=10', 'GET')
    await middleware(event)
    event.node.res.emit('finish')

    const [, data] = (appLogger.debug as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(data.path).toBe('/api/search')
    expect(data.path).not.toContain('?')
  })

  it('uses empty traceId when event context has no traceId', async () => {
    const { default: middleware } = await import('../../server/middleware/02.request-diagnostics')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent()
    await middleware(event)
    event.node.res.emit('finish')

    const [, data] = (appLogger.debug as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(data.traceId).toBe('')
  })

  it('does not include request or response body in diagnostics', async () => {
    const { default: middleware } = await import('../../server/middleware/02.request-diagnostics')
    const { appLogger } = await import('../../server/utils/logger')

    const event = makeEvent('/api/recipes', 'POST')
    await middleware(event)
    event.node.res.emit('finish')

    const [, data] = (appLogger.debug as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(data).not.toHaveProperty('body')
    expect(data).not.toHaveProperty('requestBody')
    expect(data).not.toHaveProperty('responseBody')
  })
})
