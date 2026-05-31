import type { H3Event } from 'h3'
import { getMethod, getQuery, getRequestHeaders, readRawBody } from 'h3'
import { redactHeaders } from './redaction'
import { isUrl, sanitizeUrl } from './urlSanitizer'

/** HTTP methods that may carry a request body. */
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Maximum body size (1 MiB) before structural parsing is skipped. */
const ONE_MIB = 1024 * 1024

/** Metadata derived from the request body. */
export interface BodyMetadata {
  request_body_size: number
  request_content_type?: string
  structure_parse_skipped?: true
  json_key_count?: number
  xml_tag_count?: number
}

/** Full request metadata safe for structured DEBUG logging. */
export interface RequestMetadata {
  request_headers: Record<string, string>
  query_params: Record<string, string>
  request_body_size?: number
  request_content_type?: string
  structure_parse_skipped?: boolean
  json_key_count?: number
  xml_tag_count?: number
}

/** Returns query params with any URL-shaped values reduced to scheme/host/path. */
export function sanitizeQueryParams(params: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    result[key] = isUrl(value) ? sanitizeUrl(value) : value
  }
  return result
}

/** Returns true when the content-type indicates JSON. */
function isJsonContentType(contentType: string): boolean {
  return contentType.includes('application/json')
}

/** Returns true when the content-type indicates XML. */
function isXmlContentType(contentType: string): boolean {
  return contentType.includes('application/xml') || contentType.includes('text/xml')
}

/**
 * Counts the number of direct child elements of the XML root element.
 * Uses a simple depth-tracking state machine that handles comments, CDATA,
 * processing instructions, and self-closing tags.
 * Returns 0 when the XML has no recognizable root element.
 */
function countXmlTopLevelChildren(xml: string): number {
  const stripped = xml.replace(/<\?xml[^>]*?\?>/gi, '').trim()

  let pos = 0
  let depth = 0
  let count = 0

  while (pos < stripped.length) {
    const lt = stripped.indexOf('<', pos)
    if (lt < 0) break

    // Comment: skip to -->
    if (stripped.startsWith('<!--', lt)) {
      const end = stripped.indexOf('-->', lt + 4)
      pos = end < 0 ? stripped.length : end + 3
      continue
    }

    // CDATA: skip to ]]>
    if (stripped.startsWith('<![CDATA[', lt)) {
      const end = stripped.indexOf(']]>', lt + 9)
      pos = end < 0 ? stripped.length : end + 3
      continue
    }

    // Processing instruction: skip to ?>
    if (stripped[lt + 1] === '?') {
      const end = stripped.indexOf('?>', lt + 2)
      pos = end < 0 ? stripped.length : end + 2
      continue
    }

    // Closing tag: decrement depth
    if (stripped[lt + 1] === '/') {
      const end = stripped.indexOf('>', lt)
      pos = end < 0 ? stripped.length : end + 1
      depth--
      continue
    }

    // Opening or self-closing tag
    const end = stripped.indexOf('>', lt)
    if (end < 0) break
    const tagContent = stripped.slice(lt + 1, end)
    const selfClosing = tagContent.trimEnd().endsWith('/')

    if (!selfClosing) {
      if (depth === 1) count++ // Direct child of root element
      depth++
    } else {
      if (depth === 1) count++ // Self-closing direct child of root element
    }

    pos = end + 1
  }

  return count
}

/**
 * Derives body metadata from a raw Buffer: byte size, content-type, and
 * structural counts (JSON key count or XML tag count). Bodies larger than
 * 1 MiB set `structure_parse_skipped: true` and omit counts. Unparseable
 * bodies return size and content-type only.
 */
export function analyzeBody(body: Buffer, contentType: string): BodyMetadata {
  const size = body.byteLength
  const base: BodyMetadata = {
    request_body_size: size,
    ...(contentType ? { request_content_type: contentType } : {}),
  }

  if (size > ONE_MIB) {
    return { ...base, structure_parse_skipped: true }
  }

  if (isJsonContentType(contentType)) {
    try {
      const parsed: unknown = JSON.parse(body.toString('utf-8'))
      if (parsed !== null && typeof parsed === 'object') {
        const count = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length
        return { ...base, json_key_count: count }
      }
    } catch {
      // Unparseable body: return size and content-type only
    }
    return base
  }

  if (isXmlContentType(contentType)) {
    try {
      const count = countXmlTopLevelChildren(body.toString('utf-8'))
      if (count > 0) {
        return { ...base, xml_tag_count: count }
      }
    } catch {
      // Unparseable body: return size and content-type only
    }
    return base
  }

  return base
}

/**
 * Extracts safe request metadata from an H3 event for **Request Diagnostics
 * Logging**. Reads and caches the body for body-supporting methods so
 * downstream route handlers can still access the full payload unchanged.
 * Returns only headers (redacted), query params (URL-sanitized), and body
 * metadata — never raw body content.
 */
export async function extractRequestMetadata(event: H3Event): Promise<RequestMetadata> {
  const rawHeaders = getRequestHeaders(event)
  const request_headers = redactHeaders(rawHeaders)

  const rawQuery = getQuery(event) as Record<string, string | string[] | undefined>
  const flatQuery: Record<string, string> = {}
  for (const [key, value] of Object.entries(rawQuery)) {
    if (value === undefined) continue
    flatQuery[key] = Array.isArray(value) ? value[0] ?? '' : value
  }
  const query_params = sanitizeQueryParams(flatQuery)

  if (!BODY_METHODS.has(getMethod(event))) {
    return { request_headers, query_params }
  }

  try {
    const rawBody = await readRawBody(event, false)
    if (!rawBody || rawBody.byteLength === 0) {
      return { request_headers, query_params }
    }
    const contentType = rawHeaders['content-type'] ?? ''
    const bodyMeta = analyzeBody(rawBody as Buffer, contentType)
    return { request_headers, query_params, ...bodyMeta }
  } catch {
    return { request_headers, query_params }
  }
}
