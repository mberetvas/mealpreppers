import { describe, expect, it } from 'vitest'
import {
  AISLE_CATEGORY_ORDER,
  coerceAisleCategory,
} from '../../server/services/shopping-list/aisleSort'

describe('AISLE_CATEGORY_ORDER', () => {
  it('ends with other as catch-all', () => {
    expect(AISLE_CATEGORY_ORDER[AISLE_CATEGORY_ORDER.length - 1]).toBe('other')
  })

  it('places spices between dry_goods and canned_sauces', () => {
    const dryGoodsIdx = AISLE_CATEGORY_ORDER.indexOf('dry_goods')
    const spicesIdx = AISLE_CATEGORY_ORDER.indexOf('spices')
    const cannedIdx = AISLE_CATEGORY_ORDER.indexOf('canned_sauces')
    expect(spicesIdx).toBeGreaterThan(dryGoodsIdx)
    expect(spicesIdx).toBeLessThan(cannedIdx)
  })
})

describe('coerceAisleCategory', () => {
  it('returns valid enum members unchanged', () => {
    expect(coerceAisleCategory('produce')).toBe('produce')
    expect(coerceAisleCategory('spices')).toBe('spices')
  })

  it('coerces unknown strings to other', () => {
    expect(coerceAisleCategory('xyz')).toBe('other')
    expect(coerceAisleCategory(undefined)).toBe('other')
    expect(coerceAisleCategory(null)).toBe('other')
    expect(coerceAisleCategory(42)).toBe('other')
  })
})
