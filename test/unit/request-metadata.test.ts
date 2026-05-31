import { describe, expect, it } from 'vitest'
import { analyzeBody, sanitizeQueryParams } from '../../server/utils/requestMetadata'
import { redactHeaders } from '../../server/utils/redaction'

// ---------------------------------------------------------------------------
// sanitizeQueryParams
// ---------------------------------------------------------------------------

describe('sanitizeQueryParams', () => {
  it('returns plain string values unchanged', () => {
    expect(sanitizeQueryParams({ draft: 'true', limit: '10' })).toEqual({
      draft: 'true',
      limit: '10',
    })
  })

  it('reduces a URL-shaped value to scheme/host/path', () => {
    const result = sanitizeQueryParams({
      target_url: 'https://user:pass@example.com/api?token=abc#section',
    })
    expect(result.target_url).toBe('https://example.com/api')
  })

  it('preserves non-URL query param values alongside sanitized ones', () => {
    const result = sanitizeQueryParams({
      target_url: 'https://example.com/api?q=secret',
      page: '2',
    })
    expect(result.target_url).toBe('https://example.com/api')
    expect(result.page).toBe('2')
  })

  it('sanitizes any URL-shaped value, not just target_url', () => {
    const result = sanitizeQueryParams({
      redirect: 'https://user:pw@other.com/path?a=b',
    })
    expect(result.redirect).toBe('https://other.com/path')
  })

  it('leaves an empty object unchanged', () => {
    expect(sanitizeQueryParams({})).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// analyzeBody — JSON
// ---------------------------------------------------------------------------

describe('analyzeBody — JSON', () => {
  it('returns json_key_count for a flat JSON object', () => {
    const body = Buffer.from(JSON.stringify({ a: 1, b: 'two', c: [3] }))
    const result = analyzeBody(body, 'application/json')
    expect(result.json_key_count).toBe(3)
    expect(result.request_body_size).toBe(body.byteLength)
    expect(result.request_content_type).toBe('application/json')
  })

  it('returns json_key_count for a JSON array (item count)', () => {
    const body = Buffer.from(JSON.stringify([1, 2, 3, 4]))
    const result = analyzeBody(body, 'application/json')
    expect(result.json_key_count).toBe(4)
  })

  it('does not include xml_tag_count for JSON bodies', () => {
    const body = Buffer.from(JSON.stringify({ x: 1 }))
    const result = analyzeBody(body, 'application/json')
    expect(result).not.toHaveProperty('xml_tag_count')
  })

  it('returns size and content_type only for unparseable JSON', () => {
    const body = Buffer.from('not valid json }{')
    const result = analyzeBody(body, 'application/json')
    expect(result.request_body_size).toBe(body.byteLength)
    expect(result.request_content_type).toBe('application/json')
    expect(result).not.toHaveProperty('json_key_count')
    expect(result).not.toHaveProperty('xml_tag_count')
  })

  it('handles application/json with charset suffix', () => {
    const body = Buffer.from(JSON.stringify({ key: 'val' }))
    const result = analyzeBody(body, 'application/json; charset=utf-8')
    expect(result.json_key_count).toBe(1)
  })

  it('counts top-level keys only, not nested object keys', () => {
    const body = Buffer.from(JSON.stringify({ a: { b: 1, c: 2, d: 3 }, e: 5 }))
    const result = analyzeBody(body, 'application/json')
    expect(result.json_key_count).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// analyzeBody — XML
// ---------------------------------------------------------------------------

describe('analyzeBody — XML', () => {
  it('returns xml_tag_count for a simple XML body', () => {
    const xml = '<root><child1>a</child1><child2>b</child2></root>'
    const body = Buffer.from(xml)
    const result = analyzeBody(body, 'application/xml')
    expect(result.xml_tag_count).toBe(2)
    expect(result.request_content_type).toBe('application/xml')
  })

  it('returns xml_tag_count ignoring the XML declaration', () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?><order><item>A</item><item>B</item></order>'
    const body = Buffer.from(xml)
    const result = analyzeBody(body, 'application/xml')
    expect(result.xml_tag_count).toBe(2)
  })

  it('counts self-closing tags as direct children', () => {
    const xml = '<root><a/><b>text</b><c/></root>'
    const body = Buffer.from(xml)
    const result = analyzeBody(body, 'application/xml')
    expect(result.xml_tag_count).toBe(3)
  })

  it('does not count nested elements in the top-level count', () => {
    const xml = '<root><parent><nested1/><nested2/></parent><sibling/></root>'
    const body = Buffer.from(xml)
    const result = analyzeBody(body, 'application/xml')
    expect(result.xml_tag_count).toBe(2)
  })

  it('handles text/xml content-type', () => {
    const xml = '<root><a/></root>'
    const body = Buffer.from(xml)
    const result = analyzeBody(body, 'text/xml')
    expect(result.xml_tag_count).toBe(1)
  })

  it('does not include json_key_count for XML bodies', () => {
    const xml = '<root><a/></root>'
    const body = Buffer.from(xml)
    const result = analyzeBody(body, 'application/xml')
    expect(result).not.toHaveProperty('json_key_count')
  })

  it('returns size and content_type only for non-XML content with XML content-type', () => {
    const body = Buffer.from('plain text body')
    const result = analyzeBody(body, 'application/xml')
    expect(result.request_body_size).toBe(body.byteLength)
    expect(result).not.toHaveProperty('xml_tag_count')
  })
})

// ---------------------------------------------------------------------------
// analyzeBody — body over 1 MiB
// ---------------------------------------------------------------------------

describe('analyzeBody — oversized body', () => {
  it('sets structure_parse_skipped: true and logs full size when body exceeds 1 MiB', () => {
    const ONE_MIB = 1024 * 1024
    const largeBody = Buffer.alloc(ONE_MIB + 1)
    const result = analyzeBody(largeBody, 'application/json')
    expect(result.structure_parse_skipped).toBe(true)
    expect(result.request_body_size).toBe(ONE_MIB + 1)
    expect(result).not.toHaveProperty('json_key_count')
    expect(result).not.toHaveProperty('xml_tag_count')
  })

  it('does not set structure_parse_skipped for a body at exactly 1 MiB', () => {
    const ONE_MIB = 1024 * 1024
    const body = Buffer.alloc(ONE_MIB)
    const result = analyzeBody(body, 'application/json')
    expect(result).not.toHaveProperty('structure_parse_skipped')
  })

  it('reflects the full body byte length even when structure is skipped', () => {
    const largeBody = Buffer.alloc(2 * 1024 * 1024)
    const result = analyzeBody(largeBody, 'application/xml')
    expect(result.request_body_size).toBe(largeBody.byteLength)
    expect(result.structure_parse_skipped).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// analyzeBody — unknown content-type
// ---------------------------------------------------------------------------

describe('analyzeBody — unknown content-type', () => {
  it('returns only size and content-type for text/plain bodies', () => {
    const body = Buffer.from('hello world')
    const result = analyzeBody(body, 'text/plain')
    expect(result.request_body_size).toBe(body.byteLength)
    expect(result.request_content_type).toBe('text/plain')
    expect(result).not.toHaveProperty('json_key_count')
    expect(result).not.toHaveProperty('xml_tag_count')
  })

  it('returns only size when content-type is empty', () => {
    const body = Buffer.from('data')
    const result = analyzeBody(body, '')
    expect(result.request_body_size).toBe(body.byteLength)
    expect(result).not.toHaveProperty('json_key_count')
    expect(result).not.toHaveProperty('xml_tag_count')
  })
})

// ---------------------------------------------------------------------------
// redactHeaders
// ---------------------------------------------------------------------------

describe('redactHeaders', () => {
  it('redacts the authorization header', () => {
    const result = redactHeaders({ authorization: 'Bearer token123' })
    expect(result.authorization).toBe('[REDACTED]')
  })

  it('redacts the cookie header', () => {
    const result = redactHeaders({ cookie: 'session=abc; pref=dark' })
    expect(result.cookie).toBe('[REDACTED]')
  })

  it('preserves non-sensitive headers unchanged', () => {
    const result = redactHeaders({
      'content-type': 'application/json',
      'x-trace-id': 'trace-123',
      host: 'example.com',
    })
    expect(result['content-type']).toBe('application/json')
    expect(result['x-trace-id']).toBe('trace-123')
    expect(result.host).toBe('example.com')
  })

  it('performs case-insensitive matching for sensitive header names', () => {
    const result = redactHeaders({
      Authorization: 'Bearer abc',
      COOKIE: 'session=xyz',
      Token: 'tok-123',
    })
    expect(result.Authorization).toBe('[REDACTED]')
    expect(result.COOKIE).toBe('[REDACTED]')
    expect(result.Token).toBe('[REDACTED]')
  })

  it('omits headers with undefined values', () => {
    const result = redactHeaders({ host: 'example.com', missing: undefined })
    expect(result).not.toHaveProperty('missing')
  })

  it('redacts all SENSITIVE_KEYS entries when used as header names', () => {
    const headers: Record<string, string | undefined> = {
      authorization: '1',
      cookie: '2',
      token: '3',
      secret: '4',
      password: '5',
    }
    const result = redactHeaders(headers)
    for (const key of Object.keys(headers)) {
      expect(result[key], `${key} should be redacted`).toBe('[REDACTED]')
    }
  })

  it('returns an empty object for an empty input', () => {
    expect(redactHeaders({})).toEqual({})
  })
})
