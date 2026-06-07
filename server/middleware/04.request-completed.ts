import { defineEventHandler, getHeader, getMethod, getRequestURL } from 'h3'
import { appLogger, logConfig } from '../utils/logger'
import { useStructuredLogger } from '../utils/structuredLogger'
import { useTraceId } from './01.trace-context'

/**
 * **Request Completion Logging** — emits a structured `http.request_completed` event at INFO
 * for every non-health client→gateway request when the resolved **Log Level** is not `debug`.
 *
 * When the level is `debug`, the **Request Diagnostics Logging** middleware (03) handles
 * per-request logging; this middleware is a no-op in that case to avoid double-logging.
 *
 * Includes `method`, `path`, `status_code`, and `latency_ms`, plus any context already bound
 * by upstream middleware (`trace_id`, `user_agent` when present).
 * Request and response bodies are never logged.
 */
export default defineEventHandler((event) => {
  if (logConfig.level === 'debug') return

  const method = getMethod(event)
  const path = getRequestURL(event).pathname

  if (method === 'GET' && path === '/health') return

  const startTime = Date.now()

  event.node.res.once('finish', () => {
    const latency_ms = Date.now() - startTime
    const status_code = event.node.res.statusCode
    const traceId = useTraceId(event)
    const userAgent = getHeader(event, 'user-agent')

    useStructuredLogger(appLogger, traceId).info('http.request_completed', {
      method,
      path,
      status_code,
      latency_ms,
      ...(userAgent !== undefined ? { user_agent: userAgent } : {}),
    })
  })
})
