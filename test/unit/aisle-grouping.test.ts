import { describe, expect, it } from 'vitest'
import { groupLinesByAisle, AISLE_LABELS } from '../../utils/aisleGrouping'

const line = (id: string, name: string) => ({ id, name, quantity: undefined, unit: undefined })

describe('groupLinesByAisle: basic grouping', () => {
  it('groups a produce line under the produce aisle', () => {
    const groups = groupLinesByAisle([line('L1', 'tomaten')])
    expect(groups).toHaveLength(1)
    expect(groups[0].category).toBe('produce')
  })

  it('groups a dry_goods line under dry_goods', () => {
    const groups = groupLinesByAisle([line('L1', 'pasta')])
    expect(groups).toHaveLength(1)
    expect(groups[0].category).toBe('dry_goods')
  })

  it('unrecognized names fall into the "other" aisle', () => {
    const groups = groupLinesByAisle([line('L1', 'supercalifragilistic')])
    expect(groups[0].category).toBe('other')
  })

  it('groups multiple lines of the same category into one group', () => {
    const groups = groupLinesByAisle([
      line('L1', 'pasta'),
      line('L2', 'rijst'),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].lines).toHaveLength(2)
  })

  it('returns empty array for empty input', () => {
    expect(groupLinesByAisle([])).toHaveLength(0)
  })
})

describe('groupLinesByAisle: walk order', () => {
  it('returns groups in AISLE_CATEGORY_ORDER (produce before dairy before dry_goods)', () => {
    const groups = groupLinesByAisle([
      line('L1', 'pasta'),       // dry_goods
      line('L2', 'tomaten'),     // produce
      line('L3', 'melk'),        // dairy
    ])
    const cats = groups.map(g => g.category)
    expect(cats.indexOf('produce')).toBeLessThan(cats.indexOf('dairy'))
    expect(cats.indexOf('dairy')).toBeLessThan(cats.indexOf('dry_goods'))
  })

  it('omits categories with no lines', () => {
    const groups = groupLinesByAisle([line('L1', 'pasta')])
    const cats = groups.map(g => g.category)
    expect(cats).not.toContain('produce')
    expect(cats).not.toContain('dairy')
    expect(cats).toContain('dry_goods')
  })
})

describe('groupLinesByAisle: Dutch labels', () => {
  it('assigns the Dutch label to each group', () => {
    const groups = groupLinesByAisle([line('L1', 'pasta')])
    expect(groups[0].label).toBe(AISLE_LABELS.dry_goods)
  })

  it('AISLE_LABELS covers all aisle categories with non-empty strings', () => {
    const labels = Object.values(AISLE_LABELS)
    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) {
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('produce label is "Groente & fruit"', () => {
    expect(AISLE_LABELS.produce).toBe('Groente & fruit')
  })

  it('other label is "Overig"', () => {
    expect(AISLE_LABELS.other).toBe('Overig')
  })
})

describe('groupLinesByAisle: line distribution', () => {
  it('places lines in correct categories across multiple aisles', () => {
    const groups = groupLinesByAisle([
      line('L1', 'tomaten'),    // produce
      line('L2', 'melk'),       // dairy
      line('L3', 'pasta'),      // dry_goods
      line('L4', 'olijfolie'),  // oils
    ])
    const map = Object.fromEntries(groups.map(g => [g.category, g.lines]))
    expect(map.produce?.map((l: { id: string }) => l.id)).toEqual(['L1'])
    expect(map.dairy?.map((l: { id: string }) => l.id)).toEqual(['L2'])
    expect(map.dry_goods?.map((l: { id: string }) => l.id)).toEqual(['L3'])
    expect(map.oils?.map((l: { id: string }) => l.id)).toEqual(['L4'])
  })

  it('preserves insertion order within a group', () => {
    const groups = groupLinesByAisle([
      line('L1', 'pasta'),
      line('L2', 'rijst'),
      line('L3', 'bloem'),
    ])
    const ids = groups[0].lines.map((l: { id: string }) => l.id)
    expect(ids).toEqual(['L1', 'L2', 'L3'])
  })
})
