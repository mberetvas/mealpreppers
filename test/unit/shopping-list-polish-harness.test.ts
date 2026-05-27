import { describe, it, expect } from 'vitest'
import { validatePolishResponse, canonicalizePolishResponse } from '../../server/services/shopping-list/polishHarness'
import type { PolishBaseline } from '../../server/services/shopping-list/exactMerge'
import type { PolishResponse } from '../../server/services/shopping-list/polishHarness'

function makeBaseline(lines: PolishBaseline['lines']): PolishBaseline {
  return { lines }
}

describe('validatePolishResponse', () => {
  describe('valid polish passes', () => {
    it('accepts a polish response that mirrors the baseline exactly', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
        { id: 'L2', name: 'tomaten', quantity: 400, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'pasta', quantity: 800, unit: 'g' },
          { id: 'L2', name: 'tomaten', quantity: 400, unit: 'g' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(true)
      expect(result.failures).toEqual([])
    })

    it('accepts polish that renames ingredients (name policy enforced via hints only)', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'fusilli', quantity: 800, unit: 'g' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(true)
      expect(result.failures).toEqual([])
    })

    it('accepts polish with reduced quantities (model may combine/reduce)', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'boter', quantity: 400, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'boter', quantity: 300, unit: 'g' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(true)
    })

    it('accepts polish when model returns a unit alias that matches baseline canonical unit', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 400, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'pasta', quantity: 400, unit: 'gram' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(true)
    })

    it('accepts polish when line ids differ only by case from baseline', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 400, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'l1', name: 'pasta', quantity: 400, unit: 'g' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(true)
    })

    it('accepts polish when model returns empty string unit and baseline has no unit', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'peper', quantity: undefined, unit: undefined, provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'peper', quantity: undefined, unit: '' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(true)
    })

    it('accepts g to kg conversion when quantity is within cap', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'suiker', quantity: 500, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'suiker', quantity: 0.5, unit: 'kg' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(true)
    })

    it('accepts merge with absorbed ids documented in changes', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'tomaten', quantity: 400, unit: 'g', provenance: [] },
        { id: 'L2', name: 'tomaten', quantity: 200, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'tomaten', quantity: 600, unit: 'g' },
        ],
        changes: [{ id: 'L1', reason: 'merged duplicate names', absorbedIds: ['L2'] }],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(true)
    })
  })

  describe('invented line id rejected', () => {
    it('rejects a polish response containing line ids not present in baseline', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'pasta', quantity: 800, unit: 'g' },
          { id: 'L99', name: 'chocolade', quantity: 200, unit: 'g' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(false)
      expect(result.failures).toContainEqual(
        expect.objectContaining({
          rule: 'no-invented-ingredients',
          lineId: 'L99',
        }),
      )
    })

    it('rejects multiple invented line ids', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'pasta', quantity: 800, unit: 'g' },
          { id: 'L50', name: 'wijn', quantity: 1, unit: 'l' },
          { id: 'L51', name: 'bier', quantity: 500, unit: 'ml' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(false)
      expect(result.failures).toHaveLength(2)
      expect(result.failures[0].rule).toBe('no-invented-ingredients')
      expect(result.failures[1].rule).toBe('no-invented-ingredients')
    })
  })

  describe('quantity inflation rejected', () => {
    it('rejects quantity that exceeds baseline sum for the same name/unit', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'pasta', quantity: 1000, unit: 'g' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(false)
      expect(result.failures).toContainEqual(
        expect.objectContaining({
          rule: 'quantity-cap',
          lineId: 'L1',
        }),
      )
    })

    it('validates quantity caps per name/unit pair across multiple lines', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'tomaten', quantity: 400, unit: 'g', provenance: [] },
        { id: 'L2', name: 'tomaten', quantity: 2, unit: 'stuks', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'tomaten', quantity: 400, unit: 'g' },
          { id: 'L2', name: 'tomaten', quantity: 5, unit: 'stuks' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(false)
      expect(result.failures).toContainEqual(
        expect.objectContaining({
          rule: 'quantity-cap',
          lineId: 'L2',
        }),
      )
    })

    it('allows equal quantity (not just less-than)', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'melk', quantity: 1.5, unit: 'l', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'melk', quantity: 1.5, unit: 'l' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(true)
    })

    it('rejects quantity inflation when the line is renamed', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 400, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'fusilli', quantity: 1000, unit: 'g' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(false)
      expect(result.failures).toContainEqual(
        expect.objectContaining({
          rule: 'quantity-cap',
          lineId: 'L1',
        }),
      )
    })
  })

  describe('unit conversion policy', () => {
    it('accepts ml to l conversion within volume family', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'melk', quantity: 500, unit: 'ml', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'melk', quantity: 0.5, unit: 'l' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(true)
    })

    it('rejects polish output that introduces units outside convertible families', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'melk', quantity: 500, unit: 'ml', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'melk', quantity: 2, unit: 'stuk' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(false)
      expect(result.failures).toContainEqual(
        expect.objectContaining({
          rule: 'unit-conversion',
          lineId: 'L1',
        }),
      )
    })

    it('accepts unit that exists in baseline for any line of that ingredient', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'olie', quantity: 2, unit: 'el', provenance: [] },
        { id: 'L2', name: 'olie', quantity: 100, unit: 'ml', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'olie', quantity: 2, unit: 'el' },
          { id: 'L2', name: 'olie', quantity: 100, unit: 'ml' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(true)
    })

    it('rejects unit borrowed from another ingredient dimension', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 400, unit: 'g', provenance: [] },
        { id: 'L2', name: 'melk', quantity: 500, unit: 'ml', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'pasta', quantity: 400, unit: 'ml' },
          { id: 'L2', name: 'melk', quantity: 500, unit: 'ml' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(false)
      expect(result.failures).toContainEqual(
        expect.objectContaining({
          rule: 'unit-conversion',
          lineId: 'L1',
        }),
      )
    })
  })

  describe('structured result for orchestration', () => {
    it('returns structured pass result (not exception)', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'water', quantity: 500, unit: 'ml', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [{ id: 'L1', name: 'water', quantity: 500, unit: 'ml' }],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result).toHaveProperty('valid', true)
      expect(result).toHaveProperty('failures')
      expect(Array.isArray(result.failures)).toBe(true)
    })

    it('returns structured fail result with all violations (not exception)', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 400, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'pasta', quantity: 999, unit: 'kg' },
          { id: 'L99', name: 'fake', quantity: 1, unit: 'stuks' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(false)
      expect(result.failures.length).toBeGreaterThanOrEqual(2)
      const rules = result.failures.map(f => f.rule)
      expect(rules).toContain('no-invented-ingredients')
    })

    it('collects all failures in a single pass (no early exit)', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'a', quantity: 100, unit: 'g', provenance: [] },
        { id: 'L2', name: 'b', quantity: 200, unit: 'ml', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'a', quantity: 999, unit: 'kg' },
          { id: 'L2', name: 'b', quantity: 999, unit: 'l' },
          { id: 'L99', name: 'c', quantity: 1, unit: 'stuks' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(false)
      expect(result.failures.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('edge cases', () => {
    it('rejects polish response that omits baseline line ids', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
        { id: 'L2', name: 'ui', quantity: 2, unit: undefined, provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'pasta', quantity: 800, unit: 'g' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(false)
      expect(result.failures).toContainEqual(
        expect.objectContaining({ rule: 'no-removed-lines', lineId: 'L2' }),
      )
    })

    it('handles empty polish response (missing baseline lines are rejected)', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(false)
      expect(result.failures).toContainEqual(
        expect.objectContaining({ rule: 'no-removed-lines', lineId: 'L1' }),
      )
    })

    it('accepts rename on baseline with single line', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'zout', quantity: 1, unit: 'tl', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'zeezout', quantity: 1, unit: 'tl' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(true)
    })

    it('accepts case-only name changes', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'Pasta', quantity: 400, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'pasta', quantity: 400, unit: 'g' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(true)
    })
  })

  describe('missing baseline lines rejected', () => {
    it('rejects response that omits a baseline line', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 400, unit: 'g', provenance: [] },
        { id: 'L2', name: 'tomaten', quantity: 200, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'pasta', quantity: 400, unit: 'g' },
          // L2 dropped
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(false)
      expect(result.failures).toContainEqual(
        expect.objectContaining({ rule: 'no-removed-lines', lineId: 'L2' }),
      )
    })

    it('accepts response that includes all baseline lines with unchanged names', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 400, unit: 'g', provenance: [] },
        { id: 'L2', name: 'tomaten', quantity: 200, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'pasta', quantity: 400, unit: 'g' },
          { id: 'L2', name: 'tomaten', quantity: 200, unit: 'g' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(true)
    })

    it('accepts empty baseline with empty response', () => {
      const baseline = makeBaseline([])
      const response: PolishResponse = { lines: [] }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(true)
      expect(result.failures).toEqual([])
    })
  })

  describe('duplicate line ids rejected', () => {
    it('rejects response with a duplicated line id', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 400, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'pasta', quantity: 400, unit: 'g' },
          { id: 'L1', name: 'pasta', quantity: 400, unit: 'g' },
        ],
      }

      const result = validatePolishResponse(response, baseline)

      expect(result.valid).toBe(false)
      expect(result.failures).toContainEqual(
        expect.objectContaining({ rule: 'no-invented-ingredients', lineId: 'L1' }),
      )
    })
  })
})

describe('canonicalizePolishResponse', () => {
  it('infers aisle from name when model category is invalid, then sorts by walk order', () => {
    const baseline = makeBaseline([
      { id: 'L1', name: 'pasta', quantity: 400, unit: 'g', provenance: [] },
      { id: 'L2', name: 'melk', quantity: 1, unit: 'l', provenance: [] },
    ])
    const response: PolishResponse = {
      lines: [
        { id: 'L2', name: 'melk', quantity: 1, unit: 'l', aisleCategory: 'not-a-category' as 'dairy' },
        { id: 'L1', name: 'pasta', quantity: 400, unit: 'g', aisleCategory: 'dry_goods' },
      ],
    }

    const canonical = canonicalizePolishResponse(response, baseline)

    expect(canonical.lines.map(l => l.id)).toEqual(['L2', 'L1'])
    expect(canonical.lines[0].aisleCategory).toBe('dairy')
    expect(canonical.lines[1].aisleCategory).toBe('dry_goods')
  })

  it('infers dry_goods for pasta when aisleCategory is missing', () => {
    const baseline = makeBaseline([
      { id: 'L1', name: 'pasta', quantity: 400, unit: 'g', provenance: [] },
    ])
    const response: PolishResponse = {
      lines: [{ id: 'L1', name: 'pasta', quantity: 400, unit: 'g' }],
    }

    const canonical = canonicalizePolishResponse(response, baseline)

    expect(canonical.lines[0].aisleCategory).toBe('dry_goods')
  })
})
