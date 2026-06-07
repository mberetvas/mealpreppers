import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OPENROUTER_SHOPPING_LIST_MODEL,
  openrouterShoppingListModelSchema,
  parseInstallSettingsPatchBody,
} from '../../server/services/settings/installSettingsValidation'

describe('openrouterShoppingListModelSchema', () => {
  it('accepts canonical provider/model slugs', () => {
    expect(openrouterShoppingListModelSchema.parse('deepseek/deepseek-v4-flash')).toBe(
      'deepseek/deepseek-v4-flash',
    )
    expect(openrouterShoppingListModelSchema.parse('anthropic/claude-3.5-sonnet')).toBe(
      'anthropic/claude-3.5-sonnet',
    )
  })

  it('rejects empty values', () => {
    expect(openrouterShoppingListModelSchema.safeParse('').success).toBe(false)
    expect(openrouterShoppingListModelSchema.safeParse('   ').success).toBe(false)
  })

  it('rejects values longer than 128 characters', () => {
    const tooLong = `provider/${'a'.repeat(120)}`
    expect(openrouterShoppingListModelSchema.safeParse(tooLong).success).toBe(false)
  })

  it('rejects invalid slug shapes', () => {
    expect(openrouterShoppingListModelSchema.safeParse('no-slash').success).toBe(false)
    expect(openrouterShoppingListModelSchema.safeParse('/missing-provider').success).toBe(false)
    expect(openrouterShoppingListModelSchema.safeParse('provider/').success).toBe(false)
  })
})

describe('parseInstallSettingsPatchBody', () => {
  it('parses a valid patch body', () => {
    const parsed = parseInstallSettingsPatchBody({
      openrouterShoppingListModel: 'deepseek/deepseek-v4-flash',
    })
    expect(parsed).toEqual({
      ok: true,
      value: { openrouterShoppingListModel: 'deepseek/deepseek-v4-flash' },
    })
  })

  it('rejects non-object bodies', () => {
    expect(parseInstallSettingsPatchBody(null).ok).toBe(false)
    expect(parseInstallSettingsPatchBody('model').ok).toBe(false)
  })

  it('requires openrouterShoppingListModel', () => {
    expect(parseInstallSettingsPatchBody({}).ok).toBe(false)
  })
})

describe('DEFAULT_OPENROUTER_SHOPPING_LIST_MODEL', () => {
  it('matches the canonical default', () => {
    expect(DEFAULT_OPENROUTER_SHOPPING_LIST_MODEL).toBe('deepseek/deepseek-v4-flash')
  })
})
