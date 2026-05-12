import { createConsola } from 'consola'
import type { ConsolaReporter, LogObject } from 'consola'

/** Supported log levels for the application logger. */
export type LogLevelName = 'debug' | 'info' | 'warn' | 'error'

/** Configuration for the application logger. */
export interface LogConfig {
  level: LogLevelName
  json: boolean
  nodeEnv: string
}

/**
 * Decouples callers from consola so the underlying reporter can be
 * swapped out (e.g. in tests) without touching call sites.
 */
export interface AppLogger {
  debug(message: string, data?: Record<string, unknown>): void
  info(message: string, data?: Record<string, unknown>): void
  warn(message: string, data?: Record<string, unknown>): void
  error(message: string, data?: Record<string, unknown>): void
  /** Returns a child logger that prefixes every message with the given tag. */
  withTag(tag: string): AppLogger
}

const LEVEL_MAP: Record<LogLevelName, number> = {
  debug: 4,
  info: 3,
  warn: 1,
  error: 0,
}

const VALID_LEVELS = new Set<string>(['debug', 'info', 'warn', 'error'])

/** A consola reporter that emits newline-delimited JSON to stdout. */
const jsonReporter: ConsolaReporter = {
  log(logObj: LogObject): void {
    const { level, tag, args, date } = logObj
    const [message, ...rest] = args as [string, ...unknown[]]
    const entry: Record<string, unknown> = {
      timestamp: date.toISOString(),
      level,
      tag: tag || undefined,
      message,
    }
    if (rest.length > 0) entry.data = rest.length === 1 ? rest[0] : rest
    process.stdout.write(JSON.stringify(entry) + '\n')
  },
}

/**
 * Resolves the effective LogConfig from environment variables,
 * applying defaults and emitting a warning for invalid LOG_LEVEL values.
 */
export function resolveLogConfig(overrides: Partial<LogConfig> = {}): LogConfig {
  const nodeEnv = overrides.nodeEnv ?? process.env.NODE_ENV ?? 'development'
  const defaultLevel: LogLevelName = nodeEnv === 'production' ? 'info' : 'debug'

  const rawLevel = process.env.LOG_LEVEL?.toLowerCase() ?? ''
  let level: LogLevelName
  if (overrides.level !== undefined) {
    level = overrides.level
  } else if (VALID_LEVELS.has(rawLevel)) {
    level = rawLevel as LogLevelName
  } else {
    if (rawLevel !== '') {
      process.stderr.write(
        `[logger] WARNING: invalid LOG_LEVEL="${process.env.LOG_LEVEL}"; defaulting to "${defaultLevel}"\n`,
      )
    }
    level = defaultLevel
  }

  const rawJson = process.env.LOG_JSON?.toLowerCase()
  const json = overrides.json ?? rawJson === 'true'

  return { level, json, nodeEnv }
}

/**
 * Wraps a consola instance in the AppLogger interface so log calls
 * always pass a message string plus an optional structured-data object.
 */
function wrapConsola(instance: ReturnType<typeof createConsola>): AppLogger {
  return {
    debug: (message, data) => instance.debug(message, ...(data ? [data] : [])),
    info: (message, data) => instance.info(message, ...(data ? [data] : [])),
    warn: (message, data) => instance.warn(message, ...(data ? [data] : [])),
    error: (message, data) => instance.error(message, ...(data ? [data] : [])),
    withTag: (tag) => wrapConsola(instance.withTag(tag) as ReturnType<typeof createConsola>),
  }
}

/**
 * Creates an AppLogger backed by a fresh consola instance.
 * Accepts optional config overrides for testability; reads env vars otherwise.
 */
export function createAppLogger(overrides: Partial<LogConfig> = {}): AppLogger {
  const config = resolveLogConfig(overrides)

  const instance = createConsola({
    level: LEVEL_MAP[config.level],
    reporters: config.json ? [jsonReporter] : undefined,
  })

  return wrapConsola(instance)
}

/** The resolved LogConfig singleton, computed once at module load from environment variables. */
export const logConfig: LogConfig = resolveLogConfig()

/** Singleton logger initialised from environment variables at module load time. */
export const appLogger: AppLogger = createAppLogger()
