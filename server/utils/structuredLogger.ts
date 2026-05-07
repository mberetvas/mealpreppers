import type { AppLogger } from './logger'

/** Canonical structured log entry — every emission must include a `domain.action` event name. */
export interface StructuredLogEntry {
  event: string
  traceId?: string
  [key: string]: unknown
}

/** Structured logger that validates event names and redacts sensitive fields before emitting. */
export interface StructuredLogger {
  log(level: 'debug' | 'info' | 'warn' | 'error', entry: StructuredLogEntry): void
  debug(event: string, data?: Record<string, unknown>): void
  info(event: string, data?: Record<string, unknown>): void
  warn(event: string, data?: Record<string, unknown>): void
  error(event: string, data?: Record<string, unknown>): void
}

const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/

/** Returns true when `name` follows the `domain.action` snake_case convention. */
export function isValidEventName(name: string): boolean {
  return EVENT_NAME_PATTERN.test(name)
}

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'auth',
  'apikey',
  'api_key',
  'credential',
  'credentials',
  'ssn',
  'credit_card',
  'cvv',
  'pin',
])

/**
 * Recursively copies `data`, replacing the values of any sensitive keys with `'[REDACTED]'`.
 * Never mutates the original object.
 */
export function redact(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]'
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redact(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * Asserts that `event` is a valid `domain.action` name.
 * Throws in non-production; logs a warning in production.
 */
function assertEventName(event: string, appLogger: AppLogger): void {
  if (isValidEventName(event)) return

  const message = `[structuredLogger] Invalid event name: "${event}". Expected "domain.action" in snake_case.`

  if (process.env.NODE_ENV !== 'production') {
    throw new TypeError(message)
  }

  appLogger.warn(message)
}

/**
 * Creates a StructuredLogger that validates event names, injects the optional
 * `traceId`, and redacts sensitive fields before delegating to `appLogger`.
 */
export function createStructuredLogger(appLogger: AppLogger, traceId?: string): StructuredLogger {
  function emit(level: 'debug' | 'info' | 'warn' | 'error', entry: StructuredLogEntry): void {
    assertEventName(entry.event, appLogger)

    const { event, traceId: entryTraceId, ...rest } = entry
    const payload = redact({
      ...(traceId !== undefined ? { traceId } : {}),
      ...(entryTraceId !== undefined ? { traceId: entryTraceId } : {}),
      ...rest,
    })

    appLogger[level](event, payload)
  }

  return {
    log: emit,
    debug: (event, data) => emit('debug', { event, ...data }),
    info: (event, data) => emit('info', { event, ...data }),
    warn: (event, data) => emit('warn', { event, ...data }),
    error: (event, data) => emit('error', { event, ...data }),
  }
}

/** Convenience alias for `createStructuredLogger`. */
export function useStructuredLogger(appLogger: AppLogger, traceId?: string): StructuredLogger {
  return createStructuredLogger(appLogger, traceId)
}
