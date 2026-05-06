import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import { defineEventHandler, getHeader, setHeader } from 'h3'

/**
 * Resolves the trace ID for the incoming request using header precedence:
 * 1. `x-trace-id` header
 * 2. `x-request-id` header
 * 3. Generated UUID (final fallback)
 */
function resolveTraceId(event: H3Event): string {
  const traceHeader = getHeader(event, 'x-trace-id')
  if (traceHeader && traceHeader.trim() !== '') return traceHeader

  const requestIdHeader = getHeader(event, 'x-request-id')
  if (requestIdHeader && requestIdHeader.trim() !== '') return requestIdHeader

  return randomUUID()
}

/**
 * Middleware that resolves a trace ID for every request, stores it on
 * `event.context.traceId`, and echoes it back via the `x-trace-id`
 * response header for observability.
 */
export default defineEventHandler((event) => {
  const traceId = resolveTraceId(event)
  event.context.traceId = traceId
  setHeader(event, 'x-trace-id', traceId)
})

/** Retrieves the trace ID from the event context for request-scoped logging. */
export function useTraceId(event: H3Event): string {
  return (event.context.traceId as string | undefined) ?? ''
}
