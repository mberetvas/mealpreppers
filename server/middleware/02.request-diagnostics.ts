import { defineEventHandler, getMethod, getRequestURL } from 'h3'
import { appLogger, logConfig } from '../utils/logger'
import { extractRequestMetadata } from '../utils/requestMetadata'
import { useStructuredLogger } from '../utils/structuredLogger'
import { useTraceId } from './01.trace-context'

/**
 * **Request Diagnostics Logging** — at DEBUG level, emits two structured events
 * for every request via the **Application Logger** and **Structured Logger** facade:
 *
 * 1. `http.request_started` — emitted immediately with safe request metadata:
 *    redacted headers, sanitized query params, body byte size, content-type,
 *    and structural counts (JSON key count or XML tag count).
 * 2. `http.request_handled` — emitted on response finish with method, path,
 *    status code, and duration.
 *
 * Bodies are read once and cached by H3 so route handlers receive the full
 * payload unchanged. Request and response body content is never logged.
 */
export default defineEventHandler(async (event) => {
  if (logConfig.level !== 'debug') return

  const method = getMethod(event)
  const path = getRequestURL(event).pathname
  const startTime = Date.now()
  const traceId = useTraceId(event)

  const metadata = await extractRequestMetadata(event)

  useStructuredLogger(appLogger, traceId).debug('http.request_started', {
    method,
    path,
    ...metadata,
  })

  event.node.res.on('finish', () => {
    const duration = Date.now() - startTime
    const statusCode = event.node.res.statusCode

    useStructuredLogger(appLogger, traceId).debug('http.request_handled', {
      method,
      path,
      statusCode,
      duration,
    })
  })
})
