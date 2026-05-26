import { describe, it, expect } from 'vitest'
import {
  crossUnitMerge,
  convertQuantity,
  unitDimension,
  pickCanonicalUnit,
} from '../../server/services/shopping-list/crossUnitMerge'
import type { PolishBaseline } from '../../server/services/shopping-list/exactMerge'

function makeBaseline(lines: PolishBaseline['lines']): PolishBaseline {
  return { lines }
}

describe('convertQuantity', () => {
  it('converts g to kg and back', () => {
    expect(convertQuantity(1000, 'g', 'kg')).toBe(1)
    expect(convertQuantity(0.5, 'kg', 'g')).toBe(500)
  })

  it('converts ml, dl, and l within volume', () => {
    expect(convertQuantity(1, 'l', 'ml')).toBe(1000)
    expect(convertQuantity(250, 'ml', 'l')).toBe(0.25)
    expect(convertQuantity(1, 'dl', 'ml')).toBe(100)
  })

  it('returns null for cross-dimension conversion', () => {
    expect(convertQuantity(100, 'g', 'ml')).toBeNull()
    expect(convertQuantity(1, 'stuk', 'g')).toBeNull()
  })

  it('returns null for unsupported units in same dimension', () => {
    expect(convertQuantity(2, 'el', 'ml')).toBeNull()
  })
})

describe('unitDimension', () => {
  it('classifies mass, volume, and count units', () => {
    expect(unitDimension('g')).toBe('mass')
    expect(unitDimension('kg')).toBe('mass')
    expect(unitDimension('ml')).toBe('volume')
    expect(unitDimension('stuk')).toBe('count')
  })

  it('treats unknown units as their own dimension key', () => {
    expect(unitDimension('scheutje')).toBe('scheutje')
  })
})

describe('pickCanonicalUnit', () => {
  it('prefers kg over g when both present', () => {
    expect(pickCanonicalUnit(['g', 'kg'])).toBe('kg')
  })

  it('prefers l over ml', () => {
    expect(pickCanonicalUnit(['ml', 'l'])).toBe('l')
  })
})

describe('crossUnitMerge', () => {
  it('merges same-name lines with convertible mass units using survivor unit', () => {
    const baseline = makeBaseline([
      { id: 'L1', name: 'tomaten', quantity: 400, unit: 'g', provenance: [] },
      { id: 'L2', name: 'tomaten', quantity: 0.5, unit: 'kg', provenance: [] },
    ])
    const result = crossUnitMerge(baseline)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0]).toMatchObject({ id: 'L1', name: 'tomaten', quantity: 900, unit: 'g' })
  })

  it('keeps different names as separate lines', () => {
    const baseline = makeBaseline([
      { id: 'L1', name: 'ui', quantity: 1, unit: undefined, provenance: [] },
      { id: 'L2', name: 'uien', quantity: 2, unit: undefined, provenance: [] },
    ])
    const result = crossUnitMerge(baseline)
    expect(result.lines).toHaveLength(2)
  })

  it('merges same-name volume lines using survivor unit', () => {
    const baseline = makeBaseline([
      { id: 'L1', name: 'melk', quantity: 250, unit: 'ml', provenance: [] },
      { id: 'L2', name: 'melk', quantity: 1, unit: 'l', provenance: [] },
    ])
    const result = crossUnitMerge(baseline)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0]).toMatchObject({ id: 'L1', name: 'melk', quantity: 1250, unit: 'ml' })
  })

  it('keeps mass and count dimensions separate for the same name', () => {
    const baseline = makeBaseline([
      { id: 'L1', name: 'pasta', quantity: 400, unit: 'g', provenance: [] },
      { id: 'L2', name: 'pasta', quantity: 2, unit: 'stuk', provenance: [] },
    ])
    const result = crossUnitMerge(baseline)
    expect(result.lines).toHaveLength(2)
  })

  it('does not convert el to ml for the same name', () => {
    const baseline = makeBaseline([
      { id: 'L1', name: 'olie', quantity: 2, unit: 'el', provenance: [] },
      { id: 'L2', name: 'olie', quantity: 100, unit: 'ml', provenance: [] },
    ])
    const result = crossUnitMerge(baseline)
    expect(result.lines).toHaveLength(2)
  })

  it('unions provenance when merging', () => {
    const baseline = makeBaseline([
      { id: 'L1', name: 'tomaten', quantity: 400, unit: 'g', provenance: [{ recipeId: 'a', recipeTitle: 'A' }] },
      { id: 'L2', name: 'tomaten', quantity: 0.5, unit: 'kg', provenance: [{ recipeId: 'b', recipeTitle: 'B' }] },
    ])
    const result = crossUnitMerge(baseline)
    expect(result.lines[0].provenance).toHaveLength(2)
  })

  it('returns empty baseline unchanged', () => {
    expect(crossUnitMerge({ lines: [] }).lines).toEqual([])
  })

  it('leaves single-line groups unchanged', () => {
    const baseline = makeBaseline([
      { id: 'L1', name: 'zout', quantity: 1, unit: 'tl', provenance: [] },
    ])
    const result = crossUnitMerge(baseline)
    expect(result.lines).toEqual(baseline.lines)
  })
})
