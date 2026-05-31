import { describe, expect, it } from 'vitest'
import { isUrl, sanitizeUrl } from '../../server/utils/urlSanitizer'

describe('sanitizeUrl', () => {
  it('strips userinfo (user:password) from the URL', () => {
    expect(sanitizeUrl('https://user:pass@example.com/path')).toBe('https://example.com/path')
  })

  it('strips query string from the URL', () => {
    expect(sanitizeUrl('https://example.com/path?q=secret&page=1')).toBe(
      'https://example.com/path',
    )
  })

  it('strips fragment from the URL', () => {
    expect(sanitizeUrl('https://example.com/path#section')).toBe('https://example.com/path')
  })

  it('strips all of userinfo, query string, and fragment together', () => {
    expect(sanitizeUrl('https://user:pass@example.com/path?q=x#frag')).toBe(
      'https://example.com/path',
    )
  })

  it('preserves scheme, host, and path', () => {
    expect(sanitizeUrl('https://api.example.com/v1/recipes')).toBe(
      'https://api.example.com/v1/recipes',
    )
  })

  it('preserves http scheme', () => {
    expect(sanitizeUrl('http://example.com/resource')).toBe('http://example.com/resource')
  })

  it('preserves port in host', () => {
    expect(sanitizeUrl('https://example.com:8080/path')).toBe('https://example.com:8080/path')
  })

  it('returns the original string when the input is not a valid URL', () => {
    expect(sanitizeUrl('not-a-url')).toBe('not-a-url')
  })

  it('returns empty string unchanged', () => {
    expect(sanitizeUrl('')).toBe('')
  })

  it('handles a URL with only scheme and host (no path)', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com/')
  })

  it('handles target_url with embedded credentials (real-world passthrough scenario)', () => {
    expect(sanitizeUrl('https://admin:secret@internal.corp/api/data?token=xyz')).toBe(
      'https://internal.corp/api/data',
    )
  })
})

describe('isUrl', () => {
  it('returns true for a valid https URL', () => {
    expect(isUrl('https://example.com/path')).toBe(true)
  })

  it('returns true for a valid http URL', () => {
    expect(isUrl('http://example.com')).toBe(true)
  })

  it('returns true for a URL with credentials', () => {
    expect(isUrl('https://user:pass@example.com')).toBe(true)
  })

  it('returns false for a plain string', () => {
    expect(isUrl('true')).toBe(false)
  })

  it('returns false for a number string', () => {
    expect(isUrl('42')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isUrl('')).toBe(false)
  })

  it('returns false for a relative path', () => {
    expect(isUrl('/api/recipes')).toBe(false)
  })

  it('returns false for a hostname without scheme', () => {
    expect(isUrl('example.com/path')).toBe(false)
  })
})
