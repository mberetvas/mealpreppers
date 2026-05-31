import { describe, expect, it } from 'vitest'
import {
  groupLinesByAisle,
  hasAisleCategories,
  AISLE_LABELS,
} from '../../utils/aisleGrouping'
import type { AisleCategory } from '../../server/services/shopping-list/aisleSort'

const line = (
  id: string,
  name: string,
  aisleCategory?: AisleCategory,
) => ({ id, name, quantity: undefined, unit: undefined, aisleCategory })

describe('hasAisleCategories', () => {
  it('is false when no line has aisleCategory', () => {
    expect(hasAisleCategories([line('L1', 'pasta')])).toBe(false)
  })

  it('is true when any line has aisleCategory', () => {
    expect(hasAisleCategories([line('L1', 'pasta', 'dry_goods')])).toBe(true)
  })
})

describe('groupLinesByAisle: legacy flat mode', () => {
  it('returns empty array when no lines have categories', () => {
    expect(groupLinesByAisle([line('L1', 'pasta')])).toEqual([])
  })

  it('returns empty array for empty input', () => {
    expect(groupLinesByAisle([])).toEqual([])
  })
})

describe('groupLinesByAisle: sequential run-length groups', () => {
  it('groups consecutive lines with the same category', () => {
    const groups = groupLinesByAisle([
      line('L1', 'tomaten', 'produce'),
      line('L2', 'sla', 'produce'),
      line('L3', 'melk', 'dairy'),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0].category).toBe('produce')
    expect(groups[0].lines.map(l => l.id)).toEqual(['L1', 'L2'])
    expect(groups[1].category).toBe('dairy')
    expect(groups[1].lines.map(l => l.id)).toEqual(['L3'])
  })

  it('preserves line order within and across groups (not global walk order)', () => {
    const groups = groupLinesByAisle([
      line('L1', 'pasta', 'dry_goods'),
      line('L2', 'tomaten', 'produce'),
      line('L3', 'rijst', 'dry_goods'),
    ])
    expect(groups.map(g => g.category)).toEqual(['dry_goods', 'produce', 'dry_goods'])
    expect(groups[0].lines[0].id).toBe('L1')
    expect(groups[2].lines[0].id).toBe('L3')
  })

  it('starts a new group when category changes', () => {
    const groups = groupLinesByAisle([
      line('L1', 'melk', 'dairy'),
      line('L2', 'tomaten', 'produce'),
      line('L3', 'kaas', 'dairy'),
    ])
    expect(groups).toHaveLength(3)
    expect(groups.map(g => g.category)).toEqual(['dairy', 'produce', 'dairy'])
  })

  it('uses other for lines missing aisleCategory when some lines have categories', () => {
    const groups = groupLinesByAisle([
      line('L1', 'pasta', 'dry_goods'),
      { id: 'L2', name: 'mystery', quantity: undefined, unit: undefined },
    ])
    expect(groups).toHaveLength(2)
    expect(groups[1].category).toBe('other')
  })

  it('assigns Dutch labels from AISLE_LABELS', () => {
    const groups = groupLinesByAisle([line('L1', 'pasta', 'dry_goods')])
    expect(groups[0].label).toBe(AISLE_LABELS.dry_goods)
  })
})

describe('AISLE_LABELS', () => {
  it('covers all aisle categories with non-empty strings', () => {
    for (const label of Object.values(AISLE_LABELS)) {
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('produce label is "Groente & fruit"', () => {
    expect(AISLE_LABELS.produce).toBe('Groente & fruit')
  })
})
