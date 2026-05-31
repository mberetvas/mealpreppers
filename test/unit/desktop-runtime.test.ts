import { describe, expect, it } from 'vitest'
import { shouldAttachDesktopToken } from '../../utils/desktopRuntime'

describe('shouldAttachDesktopToken', () => {
  const bootstrap = {
    apiBase: 'http://127.0.0.1:45678',
    token: 'secret',
  }

  it('attaches for relative API paths', () => {
    expect(shouldAttachDesktopToken('/api/v1/recipes', bootstrap)).toBe(true)
  })

  it('attaches for absolute loopback API URLs', () => {
    expect(shouldAttachDesktopToken('http://127.0.0.1:45678/api/v1/recipes', bootstrap)).toBe(true)
  })

  it('does not attach without bootstrap', () => {
    expect(shouldAttachDesktopToken('/api/v1/recipes')).toBe(false)
  })

  it('does not attach for unrelated origins', () => {
    expect(shouldAttachDesktopToken('https://example.com/api', bootstrap)).toBe(false)
  })
})
