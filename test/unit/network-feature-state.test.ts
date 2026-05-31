import { describe, expect, it } from 'vitest'
import {
  buildAiPolishUnavailableMessage,
  buildRecipeImportUnavailableMessage,
} from '../../app/composables/useNetworkFeatureState'
import { normalizeOpenRouterKeyInput } from '../../app/utils/tauriDesktop'
import { isDesktopShell, shouldAttachDesktopToken } from '../../utils/desktopRuntime'

describe('isDesktopShell', () => {
  it('returns false without window', () => {
    expect(isDesktopShell()).toBe(false)
  })
})

describe('normalizeOpenRouterKeyInput', () => {
  it('trims and returns non-empty keys', () => {
    expect(normalizeOpenRouterKeyInput('  sk-or-test  ')).toBe('sk-or-test')
  })

  it('returns null for blank input', () => {
    expect(normalizeOpenRouterKeyInput('   ')).toBeNull()
    expect(normalizeOpenRouterKeyInput('')).toBeNull()
  })
})

describe('buildAiPolishUnavailableMessage', () => {
  it('prioritizes offline messaging', () => {
    expect(buildAiPolishUnavailableMessage(true, true)).toMatch(/offline/i)
  })

  it('surfaces missing key when online on desktop', () => {
    expect(buildAiPolishUnavailableMessage(false, true)).toMatch(/Settings/i)
  })

  it('falls back to server warning when online with key', () => {
    expect(buildAiPolishUnavailableMessage(false, false, 'Server said no')).toBe('Server said no')
  })
})

describe('buildRecipeImportUnavailableMessage', () => {
  it('explains offline import blocking', () => {
    expect(buildRecipeImportUnavailableMessage(true)).toMatch(/internet connection/i)
  })
})

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
