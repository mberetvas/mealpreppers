import { describe, expect, it } from 'vitest'
import {
  inferAisleCategory,
  sortShoppingListLines,
  AISLE_CATEGORY_ORDER,
} from '../../server/services/shopping-list/aisleSort'
import type { MergedLine } from '../../server/services/shopping-list/exactMerge'

function line(id: string, name: string): MergedLine {
  return { id, name, quantity: 1, unit: 'g', provenance: [] }
}

describe('inferAisleCategory', () => {
  it('classifies produce and dairy separately', () => {
    expect(inferAisleCategory('tomaten')).toBe('produce')
    expect(inferAisleCategory('volle melk')).toBe('dairy')
  })

  it('classifies frozen before fresh produce keywords', () => {
    expect(inferAisleCategory('diepvries spinazie')).toBe('frozen')
  })

  it('uses text before preparation comma', () => {
    expect(inferAisleCategory('wortelen, geschild')).toBe('produce')
  })

  it('returns other for unknown ingredients', () => {
    expect(inferAisleCategory('xyz-onbekend-product')).toBe('other')
  })
})

describe('sortShoppingListLines', () => {
  it('orders produce before dairy for in-store shopping', () => {
    const input = [
      line('L2', 'melk'),
      line('L1', 'tomaten'),
    ]
    const sorted = sortShoppingListLines(input)
    expect(sorted.map(l => l.id)).toEqual(['L1', 'L2'])
  })

  it('sorts alphabetically within the same aisle (Dutch locale)', () => {
    const input = [
      line('L2', 'peer'),
      line('L1', 'appel'),
    ]
    const sorted = sortShoppingListLines(input)
    expect(sorted.map(l => l.name)).toEqual(['appel', 'peer'])
  })

  it('preserves relative order for equal sort keys', () => {
    const input = [
      line('L1', 'tomaten'),
      line('L2', 'Tomaten'),
    ]
    const sorted = sortShoppingListLines(input)
    expect(sorted.map(l => l.id)).toEqual(['L1', 'L2'])
  })

  it('does not mutate line fields other than order', () => {
    const input = [line('L1', 'tomaten')]
    input[0].quantity = 400
    const sorted = sortShoppingListLines(input)
    expect(sorted[0]).toMatchObject({ id: 'L1', name: 'tomaten', quantity: 400, unit: 'g' })
  })
})

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

describe('inferAisleCategory — spices and sauces', () => {
  it('classifies paprikapoeder as spices', () => {
    expect(inferAisleCategory('paprikapoeder')).toBe('spices')
  })

  it('classifies kerriepoeder as spices', () => {
    expect(inferAisleCategory('kerriepoeder')).toBe('spices')
  })

  it('keeps fresh herb peterselie as produce, not spices', () => {
    expect(inferAisleCategory('peterselie')).toBe('produce')
  })

  it('keeps fresh herb basilicum as produce, not spices', () => {
    expect(inferAisleCategory('basilicum')).toBe('produce')
  })

  it('classifies tomatenpuree as canned_sauces', () => {
    expect(inferAisleCategory('tomatenpuree')).toBe('canned_sauces')
  })

  it('classifies pesto as canned_sauces', () => {
    expect(inferAisleCategory('pesto')).toBe('canned_sauces')
  })

  it('classifies representative PRD items into correct areas', () => {
    expect(inferAisleCategory('appelazijn')).toBe('oils')
    expect(inferAisleCategory('bloemkool')).toBe('produce')
    expect(inferAisleCategory('gember')).toBe('produce')
    expect(inferAisleCategory('knoflook')).toBe('produce')
    expect(inferAisleCategory('paprikapoeder')).toBe('spices')
    expect(inferAisleCategory('peterselie')).toBe('produce')
    expect(inferAisleCategory('rode appel')).toBe('produce')
    expect(inferAisleCategory('rode paprika')).toBe('produce')
    expect(inferAisleCategory('tomatenblokjes')).toBe('canned_sauces')
    expect(inferAisleCategory('tomatenpuree')).toBe('canned_sauces')
  })
})

describe('sortShoppingListLines — spice area ordering', () => {
  it('sorts spices after dry_goods and before canned_sauces', () => {
    const input = [
      line('L3', 'tomatenblokjes'),
      line('L1', 'pasta'),
      line('L2', 'paprikapoeder'),
    ]
    const sorted = sortShoppingListLines(input)
    expect(sorted.map(l => l.id)).toEqual(['L1', 'L2', 'L3'])
  })

  it('sorts alphabetically within spices area (Dutch locale)', () => {
    const input = [
      line('L2', 'paprikapoeder'),
      line('L1', 'kerriepoeder'),
    ]
    const sorted = sortShoppingListLines(input)
    expect(sorted.map(l => l.name)).toEqual(['kerriepoeder', 'paprikapoeder'])
  })
})
