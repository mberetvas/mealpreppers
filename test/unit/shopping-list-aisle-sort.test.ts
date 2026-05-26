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
})
