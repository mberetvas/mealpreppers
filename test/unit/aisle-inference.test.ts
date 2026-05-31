import { describe, expect, it } from 'vitest'
import { inferAisleCategoryFromName } from '../../server/services/shopping-list/aisleInference'

describe('inferAisleCategoryFromName', () => {
  it('classifies common Dutch ingredients that often land in other', () => {
    expect(inferAisleCategoryFromName('chorizo, in plakjes')).toBe('meat')
    expect(inferAisleCategoryFromName('langkorrelrijst')).toBe('dry_goods')
    expect(inferAisleCategoryFromName('lente-uien')).toBe('produce')
    expect(inferAisleCategoryFromName('Lookpoeder')).toBe('spices')
    expect(inferAisleCategoryFromName('5 spice poeder')).toBe('spices')
    expect(inferAisleCategoryFromName('Sugar snaps')).toBe('produce')
    expect(inferAisleCategoryFromName('zoetpuntpaprika')).toBe('produce')
    expect(inferAisleCategoryFromName('zout')).toBe('spices')
  })

  it('classifies canned and sauce items away from dry_goods', () => {
    expect(inferAisleCategoryFromName('kikkererwten, uitgelekt')).toBe('canned_sauces')
    expect(inferAisleCategoryFromName('tomatenblokjes')).toBe('canned_sauces')
    expect(inferAisleCategoryFromName('Tomatenpuree')).toBe('canned_sauces')
    expect(inferAisleCategoryFromName('kippenbouillon')).toBe('canned_sauces')
    expect(inferAisleCategoryFromName('babymaïs')).toBe('canned_sauces')
    expect(inferAisleCategoryFromName('zoete chilisaus')).toBe('canned_sauces')
  })

  it('returns null for unknown ingredients so AI choice is kept', () => {
    expect(inferAisleCategoryFromName('geheime superfood mix')).toBeNull()
  })
})
