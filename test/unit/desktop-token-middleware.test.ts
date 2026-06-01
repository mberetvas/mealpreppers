import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { DESKTOP_TOKEN_HEADER } from '../../server/utils/desktopToken'

function makeEvent(url = '/api/v1/recipes', method = 'GET', headers: Record<string, string> = {}) {
  const socket = new Socket()
  const req = new IncomingMessage(socket)
  req.url = url
  req.method = method
  req.headers = { host: '127.0.0.1', ...headers }
  const res = new ServerResponse(req)
  return createEvent(req, res)
}

describe('desktop token middleware', () => {
  const originalToken = process.env.DESKTOP_TOKEN

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.DESKTOP_TOKEN
    }
    else {
      process.env.DESKTOP_TOKEN = originalToken
    }
    vi.resetModules()
  })

  it('does not enforce when DESKTOP_TOKEN is unset', async () => {
    delete process.env.DESKTOP_TOKEN
    const { default: middleware } = await import('../../server/middleware/00.desktop-token')
    expect(() => middleware(makeEvent())).not.toThrow()
  })

  it('allows GET /health without a token', async () => {
    process.env.DESKTOP_TOKEN = 'expected-secret-token'
    const { default: middleware } = await import('../../server/middleware/00.desktop-token')
    expect(() => middleware(makeEvent('/health', 'GET'))).not.toThrow()
  })

  it('allows page loads without a token when enforcement is on', async () => {
    process.env.DESKTOP_TOKEN = 'expected-secret-token'
    const { default: middleware } = await import('../../server/middleware/00.desktop-token')
    expect(() => middleware(makeEvent('/', 'GET'))).not.toThrow()
    expect(() => middleware(makeEvent('/recipes', 'GET'))).not.toThrow()
    expect(() => middleware(makeEvent('/_nuxt/entry.js', 'GET'))).not.toThrow()
  })

  it('rejects API requests without a token when enforcement is on', async () => {
    process.env.DESKTOP_TOKEN = 'expected-secret-token'
    const { default: middleware } = await import('../../server/middleware/00.desktop-token')
    expect(() => middleware(makeEvent('/api/v1/recipes', 'GET'))).toThrow(/desktop token/i)
  })

  it('rejects API requests with an invalid token', async () => {
    process.env.DESKTOP_TOKEN = 'expected-secret-token'
    const { default: middleware } = await import('../../server/middleware/00.desktop-token')
    expect(() =>
      middleware(makeEvent('/api/v1/recipes', 'GET', { [DESKTOP_TOKEN_HEADER]: 'wrong-token' })),
    ).toThrow(/desktop token/i)
  })

  it('allows API requests with a valid token', async () => {
    process.env.DESKTOP_TOKEN = 'expected-secret-token'
    const { default: middleware } = await import('../../server/middleware/00.desktop-token')
    expect(() =>
      middleware(makeEvent('/api/v1/recipes', 'GET', { [DESKTOP_TOKEN_HEADER]: 'expected-secret-token' })),
    ).not.toThrow()
  })
})

describe('desktopTokensMatch', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('uses timing-safe comparison', async () => {
    const { desktopTokensMatch } = await import('../../server/utils/desktopToken')
    expect(desktopTokensMatch('abc', 'abc')).toBe(true)
    expect(desktopTokensMatch('abc', 'abd')).toBe(false)
    expect(desktopTokensMatch('abc', 'abcd')).toBe(false)
  })
})
