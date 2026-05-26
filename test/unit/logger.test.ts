import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppLogger } from '../../server/utils/logger'

/** Captures stdout writes so logger output can be asserted as external behavior. */
function captureStdout(): { lines: string[]; restore: () => void } {
  const lines: string[] = []
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    lines.push(String(chunk))
    return true
  })

  return {
    lines,
    restore: () => spy.mockRestore(),
  }
}

/** Parses newline-delimited JSON log output into plain objects. */
function parseJsonLines(lines: string[]): Array<Record<string, unknown>> {
  return lines.filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>)
}

describe('createAppLogger', () => {
  let stderrOutput: string
  let stderrSpy: ReturnType<typeof vi.spyOn>
  let originalLogLevel: string | undefined
  let originalLogJson: string | undefined
  let originalNodeEnv: string | undefined

  beforeEach(() => {
    stderrOutput = ''
    originalLogLevel = process.env.LOG_LEVEL
    originalLogJson = process.env.LOG_JSON
    originalNodeEnv = process.env.NODE_ENV
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderrOutput += String(chunk)
      return true
    })
  })

  afterEach(() => {
    stderrSpy.mockRestore()
    if (originalLogLevel === undefined) delete process.env.LOG_LEVEL
    else process.env.LOG_LEVEL = originalLogLevel
    if (originalLogJson === undefined) delete process.env.LOG_JSON
    else process.env.LOG_JSON = originalLogJson
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    vi.resetModules()
  })

  it('returns an AppLogger with all required methods', () => {
    const logger = createAppLogger()
    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.withTag).toBe('function')
  })

  it('withTag returns an AppLogger', () => {
    const child = createAppLogger().withTag('api')
    expect(typeof child.debug).toBe('function')
    expect(typeof child.withTag).toBe('function')
  })

  it('accepts level override without env var', () => {
    expect(() => createAppLogger({ level: 'warn' })).not.toThrow()
  })

  it('filters emitted messages for a valid LOG_LEVEL from env', () => {
    process.env.LOG_LEVEL = 'WARN'
    const stdout = captureStdout()
    const logger = createAppLogger({ json: true })

    logger.debug('debug hidden')
    logger.info('info hidden')
    logger.warn('warn visible')
    logger.error('error visible')
    stdout.restore()

    expect(parseJsonLines(stdout.lines).map((entry) => entry.message)).toEqual([
      'warn visible',
      'error visible',
    ])
    expect(stderrOutput).toBe('')
  })

  it('does not emit a stderr warning when LOG_LEVEL is valid', () => {
    process.env.LOG_LEVEL = 'warn'
    createAppLogger()
    expect(stderrOutput).toBe('')
  })

  it('emits exactly one stderr warning for an invalid LOG_LEVEL', () => {
    process.env.LOG_LEVEL = 'verbose'
    createAppLogger()
    const warnings = (stderrOutput.match(/WARNING/g) ?? []).length
    expect(warnings).toBe(1)
    expect(stderrOutput).toContain('invalid LOG_LEVEL="verbose"')
  })

  it('defaults to debug outside production when LOG_LEVEL is absent', () => {
    delete process.env.LOG_LEVEL
    const stdout = captureStdout()
    const logger = createAppLogger({ json: true, nodeEnv: 'development' })

    logger.debug('debug visible by default')
    stdout.restore()

    expect(parseJsonLines(stdout.lines).map((entry) => entry.message)).toEqual([
      'debug visible by default',
    ])
    expect(stderrOutput).toBe('')
  })

  it('defaults to info in production when LOG_LEVEL is absent', () => {
    delete process.env.LOG_LEVEL
    const stdout = captureStdout()
    const logger = createAppLogger({ json: true, nodeEnv: 'production' })

    logger.debug('debug hidden by default')
    logger.info('info visible by default')
    stdout.restore()

    expect(parseJsonLines(stdout.lines).map((entry) => entry.message)).toEqual([
      'info visible by default',
    ])
    expect(stderrOutput).toBe('')
  })

  it('defaults to info in production when LOG_LEVEL is invalid', () => {
    process.env.LOG_LEVEL = 'nonsense'
    const stdout = captureStdout()
    const logger = createAppLogger({ json: true, nodeEnv: 'production' })

    logger.debug('debug hidden')
    logger.info('info visible')
    stdout.restore()

    expect(parseJsonLines(stdout.lines).map((entry) => entry.message)).toEqual(['info visible'])
    expect(stderrOutput).toContain('defaulting to "info"')
  })

  it('defaults to debug outside production when LOG_LEVEL is invalid', () => {
    process.env.LOG_LEVEL = 'nonsense'
    const stdout = captureStdout()
    const logger = createAppLogger({ json: true, nodeEnv: 'development' })

    logger.debug('debug visible')
    stdout.restore()

    expect(parseJsonLines(stdout.lines).map((entry) => entry.message)).toEqual(['debug visible'])
    expect(stderrOutput).toContain('defaulting to "debug"')
  })

  it('does not emit a warning when LOG_LEVEL is absent', () => {
    createAppLogger()
    expect(stderrOutput).toBe('')
  })

  it('uses JSON reporter when LOG_JSON env var is true', () => {
    process.env.LOG_JSON = 'TrUe'
    const stdout = captureStdout()
    const logger = createAppLogger({ level: 'debug' })

    logger.info('hello from env json', { requestId: 'abc' })
    stdout.restore()

    const [parsed] = parseJsonLines(stdout.lines)
    expect(parsed?.message).toBe('hello from env json')
    expect((parsed?.data as Record<string, unknown>).requestId).toBe('abc')
  })

  it('uses JSON reporter when json override is true', () => {
    const stdout = captureStdout()
    const logger = createAppLogger({ json: true, level: 'debug' })

    logger.info('hello world', { requestId: 'abc' })
    stdout.restore()

    const [parsed] = parseJsonLines(stdout.lines)
    expect(parsed?.message).toBe('hello world')
    expect((parsed?.data as Record<string, unknown>).requestId).toBe('abc')
  })

  it('emits pretty console output when LOG_JSON is false', () => {
    process.env.LOG_JSON = 'false'
    const stdout = captureStdout()
    const logger = createAppLogger({ level: 'debug' })

    logger.info('hello from pretty console')
    stdout.restore()

    expect(stdout.lines.join('')).toContain('hello from pretty console')
  })

  it('emits pretty console output when json override is false', () => {
    const stdout = captureStdout()
    const logger = createAppLogger({ json: false, level: 'debug' })

    logger.info('hello from pretty override')
    stdout.restore()

    expect(stdout.lines.join('')).toContain('hello from pretty override')
  })

  it('exports a singleton appLogger', async () => {
    const { appLogger } = await import('../../server/utils/logger')
    expect(typeof appLogger.info).toBe('function')
  })
})

describe('AppLogger — Log Redaction at output boundary', () => {
  it('redacts a top-level sensitive key before JSON output', () => {
    const stdout = captureStdout()
    const logger = createAppLogger({ json: true, level: 'debug' })
    logger.info('auth.attempt', { password: 'hunter2', user: 'alice' })
    stdout.restore()

    const [entry] = parseJsonLines(stdout.lines)
    const data = entry?.data as Record<string, unknown>
    expect(data.password).toBe('[REDACTED]')
    expect(data.user).toBe('alice')
  })

  it('redacts all required sensitive keys', () => {
    const sensitivePayload: Record<string, unknown> = {
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

    const stdout = captureStdout()
    const logger = createAppLogger({ json: true, level: 'debug' })
    logger.warn('audit.check', sensitivePayload)
    stdout.restore()

    const [entry] = parseJsonLines(stdout.lines)
    const data = entry?.data as Record<string, unknown>
    for (const key of Object.keys(sensitivePayload)) {
      expect(data[key], `key "${key}" should be redacted`).toBe('[REDACTED]')
    }
  })

  it('redacts sensitive keys case-insensitively', () => {
    const stdout = captureStdout()
    const logger = createAppLogger({ json: true, level: 'debug' })
    logger.info('session.init', { Password: 'x', TOKEN: 'y', ApiKey: 'z', safe: 'keep' })
    stdout.restore()

    const [entry] = parseJsonLines(stdout.lines)
    const data = entry?.data as Record<string, unknown>
    expect(data.Password).toBe('[REDACTED]')
    expect(data.TOKEN).toBe('[REDACTED]')
    expect(data.ApiKey).toBe('[REDACTED]')
    expect(data.safe).toBe('keep')
  })

  it('redacts sensitive keys nested inside objects', () => {
    const stdout = captureStdout()
    const logger = createAppLogger({ json: true, level: 'debug' })
    logger.debug('db.query', { user: { token: 'abc', name: 'alice' }, count: 1 })
    stdout.restore()

    const [entry] = parseJsonLines(stdout.lines)
    const data = entry?.data as Record<string, unknown>
    expect((data.user as Record<string, unknown>).token).toBe('[REDACTED]')
    expect((data.user as Record<string, unknown>).name).toBe('alice')
    expect(data.count).toBe(1)
  })

  it('does not mutate the caller data object', () => {
    const stdout = captureStdout()
    const logger = createAppLogger({ json: true, level: 'debug' })
    const original = { password: 'secret', user: 'bob' }
    logger.info('user.action', original)
    stdout.restore()

    expect(original.password).toBe('secret')
  })

  it('leaves non-sensitive keys and arrays untouched', () => {
    const stdout = captureStdout()
    const logger = createAppLogger({ json: true, level: 'debug' })
    logger.info('recipe.search', { tags: ['vegan', 'quick'], count: 5 })
    stdout.restore()

    const [entry] = parseJsonLines(stdout.lines)
    const data = entry?.data as Record<string, unknown>
    expect(data.tags).toEqual(['vegan', 'quick'])
    expect(data.count).toBe(5)
  })
})
