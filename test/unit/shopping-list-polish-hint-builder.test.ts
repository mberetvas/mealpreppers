/**
 * Unit tests for the polish hint builder (issue #027, v2 harness rules).
 */
import { describe, expect, it } from 'vitest'
import { buildPolishHints } from '../../server/services/shopping-list/polishHintBuilder'
import type { PolishBaseline } from '../../server/services/shopping-list/exactMerge'
import type { PolishResponse } from '../../server/services/shopping-list/polishHarness'

function makeBaseline(lines: PolishBaseline['lines']): PolishBaseline {
  return { lines }
}

describe('buildPolishHints', () => {
  describe('unit-conversion violations', () => {
    it('returns no hint for valid ml to l conversion', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'melk', quantity: 500, unit: 'ml', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'melk', quantity: 0.5, unit: 'l' },
        ],
      }

      const hints = buildPolishHints(response, baseline)

      expect(hints).toEqual([])
    })

    it('returns an error hint when AI uses a non-convertible unit', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'melk', quantity: 500, unit: 'ml', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'melk', quantity: 2, unit: 'stuk' },
        ],
      }

      const hints = buildPolishHints(response, baseline)

      expect(hints).toContainEqual(expect.objectContaining({
        lineId: 'L1',
        rule: 'unit-conversion',
        severity: 'error',
      }))
    })

    it('returns no hints when AI output uses a valid unit alias with same name', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 400, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'pasta', quantity: 400, unit: 'gram' },
        ],
      }

      const hints = buildPolishHints(response, baseline)

      expect(hints).toEqual([])
    })
  })

  describe('name-unchanged violations', () => {
    it('returns an info hint when AI renames an ingredient', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 400, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'fusilli', quantity: 400, unit: 'g' },
        ],
      }

      const hints = buildPolishHints(response, baseline)

      expect(hints).toContainEqual(expect.objectContaining({
        lineId: 'L1',
        rule: 'name-unchanged',
        severity: 'info',
      }))
    })
  })

  describe('quantity-cap violations', () => {
    it('returns an error hint when AI output exceeds baseline quantity cap', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'pasta', quantity: 1000, unit: 'g' },
        ],
      }

      const hints = buildPolishHints(response, baseline)

      expect(hints).toContainEqual(expect.objectContaining({
        lineId: 'L1',
        rule: 'quantity-cap',
        severity: 'error',
      }))
    })

    it('returns no hint when quantity equals baseline cap', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'boter', quantity: 400, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'boter', quantity: 400, unit: 'g' },
        ],
      }

      const hints = buildPolishHints(response, baseline)

      expect(hints).toEqual([])
    })

    it('returns no hint when quantity is below baseline cap', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'boter', quantity: 400, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'boter', quantity: 300, unit: 'g' },
        ],
      }

      const hints = buildPolishHints(response, baseline)

      expect(hints).toEqual([])
    })
  })

  describe('invented ingredients', () => {
    it('returns an error hint for line ids not present in baseline', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'pasta', quantity: 800, unit: 'g' },
          { id: 'L99', name: 'chocolade', quantity: 200, unit: 'g' },
        ],
      }

      const hints = buildPolishHints(response, baseline)

      expect(hints).toContainEqual(expect.objectContaining({
        lineId: 'L99',
        rule: 'no-invented-ingredients',
        severity: 'error',
      }))
    })
  })

  describe('removed lines', () => {
    it('returns an error hint when baseline lines are missing from response', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 400, unit: 'g', provenance: [] },
        { id: 'L2', name: 'tomaten', quantity: 200, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'pasta', quantity: 400, unit: 'g' },
        ],
      }

      const hints = buildPolishHints(response, baseline)

      expect(hints).toContainEqual(expect.objectContaining({
        lineId: 'L2',
        rule: 'no-removed-lines',
        severity: 'error',
      }))
    })

    it('returns no removed-line hint when absorption is documented', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'tomaten', quantity: 400, unit: 'g', provenance: [] },
        { id: 'L2', name: 'tomaten', quantity: 200, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'tomaten', quantity: 600, unit: 'g' },
        ],
        changes: [{ id: 'L1', reason: 'merged', absorbedIds: ['L2'] }],
      }

      const hints = buildPolishHints(response, baseline)

      expect(hints.filter(h => h.rule === 'no-removed-lines')).toEqual([])
    })
  })

  describe('hint shape', () => {
    it('includes lineId, rule, severity, and message in each hint', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 400, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'pasta', quantity: 999, unit: 'kg' },
        ],
      }

      const hints = buildPolishHints(response, baseline)

      expect(hints.length).toBeGreaterThan(0)
      for (const hint of hints) {
        expect(hint).toHaveProperty('lineId')
        expect(hint).toHaveProperty('rule')
        expect(hint).toHaveProperty('severity')
        expect(hint).toHaveProperty('message')
        expect(['info', 'error']).toContain(hint.severity)
      }
    })
  })

  describe('multiple violations across lines', () => {
    it('returns hints for multiple lines with different violations', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'suiker', quantity: 500, unit: 'g', provenance: [] },
        { id: 'L2', name: 'pasta', quantity: 400, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'suiker', quantity: 500, unit: 'kg' },
          { id: 'L2', name: 'pasta', quantity: 999, unit: 'g' },
        ],
      }

      const hints = buildPolishHints(response, baseline)

      expect(hints.length).toBeGreaterThanOrEqual(2)
      const rules = hints.map(h => h.rule)
      expect(rules).toContain('quantity-cap')
    })

    it('returns quantity-cap hint when converted unit exceeds cap', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'suiker', quantity: 500, unit: 'g', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'suiker', quantity: 999, unit: 'kg' },
        ],
      }

      const hints = buildPolishHints(response, baseline)
      const l1Hints = hints.filter(h => h.lineId === 'L1')

      expect(l1Hints).toContainEqual(expect.objectContaining({ rule: 'quantity-cap' }))
    })
  })

  describe('clean response', () => {
    it('returns empty hints array when response is valid', () => {
      const baseline = makeBaseline([
        { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
        { id: 'L2', name: 'sla', quantity: 1, unit: 'krop', provenance: [] },
      ])
      const response: PolishResponse = {
        lines: [
          { id: 'L1', name: 'pasta', quantity: 800, unit: 'g' },
          { id: 'L2', name: 'sla', quantity: 1, unit: 'krop' },
        ],
      }

      const hints = buildPolishHints(response, baseline)

      expect(hints).toEqual([])
    })
  })
})
