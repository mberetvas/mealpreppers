import { defineEventHandler, getMethod, getRequestURL } from 'h3'
import { appLogger, logConfig } from '../utils/logger'
import { useStructuredLogger } from '../utils/structuredLogger'
import { useTraceId } from './01.trace-context'

/**
 * Emits a structured `http.request_handled` diagnostic event for every
 * request when the resolved log level is `debug`. Runs after the route handler
 * via the Node.js `res.finish` event so it can capture the real status code.
 * Request and response bodies are never logged.
 */
export default defineEventHandler((event) => {
  if (logConfig.level !== 'debug') return

  const method = getMethod(event)
  const path = getRequestURL(event).pathname
  const startTime = Date.now()

  event.node.res.on('finish', () => {
    const duration = Date.now() - startTime
    const statusCode = event.node.res.statusCode
    const traceId = useTraceId(event)

    useStructuredLogger(appLogger, traceId).debug('http.request_handled', {
      method,
      path,
      statusCode,
      duration,
    })
  })
})
