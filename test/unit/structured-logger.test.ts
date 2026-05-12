import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AppLogger } from '../../server/utils/logger'
import * as structuredLoggerModule from '../../server/utils/structuredLogger'
import { redact } from '../../server/utils/redaction'
import {
  createStructuredLogger,
  isValidEventName,
  useStructuredLogger,
} from '../../server/utils/structuredLogger'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockLogger(): AppLogger & {
  calls: Array<{ level: string; message: string; data?: Record<string, unknown> }>
} {
  const calls: Array<{ level: string; message: string; data?: Record<string, unknown> }> = []
  const record = (level: string) => (message: string, data?: Record<string, unknown>) =>
    calls.push({ level, message, data })
  return {
    calls,
    debug: record('debug'),
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
    withTag: () => makeMockLogger(),
  }
}

// ---------------------------------------------------------------------------
// isValidEventName
// ---------------------------------------------------------------------------

describe('isValidEventName', () => {
  it.each([
    'recipe.created',
    'recipe.fetch_failed',
    'planning.created',
    'user.login',
    'api2.call_made',
  ])('accepts valid name: %s', (name) => {
    expect(isValidEventName(name)).toBe(true)
  })

  it.each([
    '',
    'recipe',
    'Recipe.created',
    'recipe.Created',
    'recipe.',
    '.created',
    'recipe.fetch-failed',
    'recipe fetch_failed',
    'RECIPE.CREATED',
  ])('rejects invalid name: %s', (name) => {
    expect(isValidEventName(name)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// redact
// ---------------------------------------------------------------------------

describe('redact', () => {
  it('replaces sensitive top-level keys with [REDACTED]', () => {
    const input = { password: 'secret123', user: 'alice' }
    const result = redact(input)
    expect(result.password).toBe('[REDACTED]')
    expect(result.user).toBe('alice')
  })

  it('is case-insensitive for key matching', () => {
    const result = redact({ Password: 'x', TOKEN: 'y', ApiKey: 'z' })
    expect(result.Password).toBe('[REDACTED]')
    expect(result.TOKEN).toBe('[REDACTED]')
    expect(result.ApiKey).toBe('[REDACTED]')
  })

  it('redacts all sensitive keys in the list', () => {
    const sensitive: Record<string, unknown> = {
      password: '1',
      token: '2',
      secret: '3',
      authorization: '4',
      auth: '5',
      apikey: '6',
      api_key: '7',
      credential: '8',
      credentials: '9',
      ssn: '10',
      credit_card: '11',
      cvv: '12',
      pin: '13',
    }
    const result = redact(sensitive)
    for (const key of Object.keys(sensitive)) {
      expect(result[key]).toBe('[REDACTED]')
    }
  })

  it('recursively redacts nested sensitive keys', () => {
    const input = { user: { token: 'abc', name: 'alice' }, count: 1 }
    const result = redact(input)
    expect((result.user as Record<string, unknown>).token).toBe('[REDACTED]')
    expect((result.user as Record<string, unknown>).name).toBe('alice')
    expect(result.count).toBe(1)
  })

  it('does not mutate the original object', () => {
    const input = { password: 'secret', nested: { token: 'tok' } }
    redact(input)
    expect(input.password).toBe('secret')
    expect((input.nested as Record<string, unknown>).token).toBe('tok')
  })

  it('leaves arrays as-is', () => {
    const input = { tags: ['a', 'b'], password: 'x' }
    const result = redact(input)
    expect(result.tags).toEqual(['a', 'b'])
    expect(result.password).toBe('[REDACTED]')
  })
})

// ---------------------------------------------------------------------------
// createStructuredLogger / useStructuredLogger
// ---------------------------------------------------------------------------

describe('createStructuredLogger', () => {
  let originalNodeEnv: string | undefined

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
  })

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
  })

  it('emits info with the event as message', () => {
    const mock = makeMockLogger()
    const logger = createStructuredLogger(mock)
    logger.info('recipe.created', { recipeId: '1' })
    expect(mock.calls[0]?.message).toBe('recipe.created')
    expect(mock.calls[0]?.level).toBe('info')
  })

  it('supports all log levels', () => {
    const mock = makeMockLogger()
    const logger = createStructuredLogger(mock)
    logger.debug('recipe.debug_event')
    logger.info('recipe.info_event')
    logger.warn('recipe.warn_event')
    logger.error('recipe.error_event')
    expect(mock.calls.map((c) => c.level)).toEqual(['debug', 'info', 'warn', 'error'])
  })

  it('injects traceId from factory into every emission', () => {
    const mock = makeMockLogger()
    const logger = createStructuredLogger(mock, 'trace-abc')
    logger.info('recipe.created')
    expect(mock.calls[0]?.data?.traceId).toBe('trace-abc')
  })

  it('entry-level traceId overrides factory traceId', () => {
    const mock = makeMockLogger()
    const logger = createStructuredLogger(mock, 'factory-trace')
    logger.log('info', { event: 'recipe.created', traceId: 'entry-trace' })
    expect(mock.calls[0]?.data?.traceId).toBe('entry-trace')
  })

  it('redacts sensitive fields before emitting', () => {
    const mock = makeMockLogger()
    const logger = createStructuredLogger(mock)
    logger.info('user.login', { password: 'hunter2', username: 'alice' })
    expect(mock.calls[0]?.data?.password).toBe('[REDACTED]')
    expect(mock.calls[0]?.data?.username).toBe('alice')
  })

  it('throws TypeError for invalid event name in non-production', () => {
    process.env.NODE_ENV = 'development'
    const mock = makeMockLogger()
    const logger = createStructuredLogger(mock)
    expect(() => logger.info('BadEvent')).toThrow(TypeError)
  })

  it('warns and continues for invalid event name in production', () => {
    process.env.NODE_ENV = 'production'
    const mock = makeMockLogger()
    const logger = createStructuredLogger(mock)
    expect(() => logger.info('BadEvent')).not.toThrow()
    expect(mock.calls[0]?.level).toBe('warn')
  })

  it('log() method works with StructuredLogEntry', () => {
    const mock = makeMockLogger()
    const logger = createStructuredLogger(mock)
    logger.log('error', { event: 'recipe.fetch_failed', recipeId: '99' })
    expect(mock.calls[0]?.level).toBe('error')
    expect(mock.calls[0]?.message).toBe('recipe.fetch_failed')
    expect(mock.calls[0]?.data?.recipeId).toBe('99')
  })

  it('does not include traceId key when not provided', () => {
    const mock = makeMockLogger()
    const logger = createStructuredLogger(mock)
    logger.info('recipe.created', { recipeId: '1' })
    expect(mock.calls[0]?.data).not.toHaveProperty('traceId')
  })
})

describe('useStructuredLogger', () => {
  it('is an alias for createStructuredLogger', () => {
    const mock = makeMockLogger()
    const logger = useStructuredLogger(mock, 'trace-xyz')
    logger.info('planning.created')
    expect(mock.calls[0]?.data?.traceId).toBe('trace-xyz')
  })
})

describe('structuredLogger module exports', () => {
  it('does not re-export redaction helpers', () => {
    expect(structuredLoggerModule).not.toHaveProperty('redact')
  })
})
