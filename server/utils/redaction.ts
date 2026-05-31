/**
 * Shared **Log Redaction** policy for the **Application Logger**.
 *
 * All keys listed here are masked to `'[REDACTED]'` before any structured
 * payload leaves the logger boundary. Matching is case-insensitive so callers
 * cannot accidentally bypass the policy through mixed-case key names.
 *
 * This policy is the single source of truth for the project's **Log Redaction**
 * requirement — both the **Application Logger** and the **Structured Logger**
 * facade import from here so the same rules apply everywhere.
 * The `cookie` and `authorization` keys are included to cover HTTP headers
 * captured during **Request Diagnostics Logging**.
 */
export const SENSITIVE_KEYS = new Set([
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
  'cookie',
])

/**
 * Recursively copies `data`, replacing the value of every key whose lowercase
 * form is in `SENSITIVE_KEYS` with `'[REDACTED]'`.
 *
 * Never mutates the original object. Arrays are copied by reference — only
 * plain-object values are traversed.
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
 * Copies an HTTP header map, replacing the value of every header whose
 * lowercase name is in `SENSITIVE_KEYS` with `'[REDACTED]'`.
 * Headers with `undefined` values are omitted from the result.
 * Matching is case-insensitive, covering both `Authorization` and `authorization`.
 */
export function redactHeaders(
  headers: Record<string, string | undefined>,
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue
    result[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : value
  }
  return result
}
