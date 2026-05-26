/**
 * Unit tests for Shopping list source fingerprint (issue #027).
 * Verifies stability, change detection, and canonical body digest.
 */
import { describe, expect, it } from 'vitest'
import { computeSourceFingerprint } from '../../server/services/shopping-list/sourceFingerprint'
import type { WeekPlanV1 } from '../../types/planning'

function makeWeekPlanBody(overrides?: Partial<WeekPlanV1['days']>): WeekPlanV1 {
  const emptySlot = { recipeId: null }
  const day = { breakfast: emptySlot, lunch: emptySlot, dinner: emptySlot }
  return {
    version: 'week_v1',
    days: {
      '1': day,
      '2': day,
      '3': day,
      '4': day,
      '5': day,
      '6': day,
      '7': day,
      ...overrides,
    },
  }
}

describe('computeSourceFingerprint', () => {
  describe('stability', () => {
    it('produces the same digest for identical plan bodies', () => {
      const body = makeWeekPlanBody({
        '1': { breakfast: { recipeId: 'recipe-a' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
      })

      const hash1 = computeSourceFingerprint(body)
      const hash2 = computeSourceFingerprint(body)

      expect(hash1).toBe(hash2)
    })

    it('produces the same digest regardless of object key insertion order', () => {
      const body1: WeekPlanV1 = {
        version: 'week_v1',
        days: {
          '1': { breakfast: { recipeId: 'r1' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
          '2': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
          '3': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
          '4': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
          '5': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
          '6': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
          '7': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
        },
      }

      // Same content but constructed with keys in different order
      const body2: WeekPlanV1 = {
        version: 'week_v1',
        days: {
          '7': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
          '6': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
          '5': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
          '4': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
          '3': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
          '2': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
          '1': { breakfast: { recipeId: 'r1' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
        },
      }

      expect(computeSourceFingerprint(body1)).toBe(computeSourceFingerprint(body2))
    })

    it('produces the same digest when meal keys are reordered within a day', () => {
      const body1: WeekPlanV1 = {
        version: 'week_v1',
        days: {
          '1': { breakfast: { recipeId: 'r1' }, lunch: { recipeId: 'r2' }, dinner: { recipeId: 'r3' } },
          '2': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
          '3': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
          '4': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
          '5': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
          '6': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
          '7': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
        },
      }

      // Same data with meal keys reordered
      const body2 = JSON.parse(JSON.stringify(body1))
      const day1 = body2.days['1']
      body2.days['1'] = { dinner: day1.dinner, breakfast: day1.breakfast, lunch: day1.lunch }

      expect(computeSourceFingerprint(body1)).toBe(computeSourceFingerprint(body2 as WeekPlanV1))
    })

    it('returns a hex string', () => {
      const body = makeWeekPlanBody()
      const hash = computeSourceFingerprint(body)

      expect(hash).toMatch(/^[a-f0-9]+$/)
    })
  })

  describe('change detection', () => {
    it('produces a different digest when a recipe is added', () => {
      const before = makeWeekPlanBody()
      const after = makeWeekPlanBody({
        '1': { breakfast: { recipeId: 'recipe-new' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
      })

      expect(computeSourceFingerprint(before)).not.toBe(computeSourceFingerprint(after))
    })

    it('produces a different digest when a recipe is removed', () => {
      const before = makeWeekPlanBody({
        '1': { breakfast: { recipeId: 'recipe-a' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
      })
      const after = makeWeekPlanBody()

      expect(computeSourceFingerprint(before)).not.toBe(computeSourceFingerprint(after))
    })

    it('produces a different digest when a recipe is moved to a different slot', () => {
      const before = makeWeekPlanBody({
        '1': { breakfast: { recipeId: 'recipe-a' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
      })
      const after = makeWeekPlanBody({
        '1': { breakfast: { recipeId: null }, lunch: { recipeId: 'recipe-a' }, dinner: { recipeId: null } },
      })

      expect(computeSourceFingerprint(before)).not.toBe(computeSourceFingerprint(after))
    })

    it('produces a different digest when a recipe id changes', () => {
      const before = makeWeekPlanBody({
        '3': { breakfast: { recipeId: 'recipe-a' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
      })
      const after = makeWeekPlanBody({
        '3': { breakfast: { recipeId: 'recipe-b' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
      })

      expect(computeSourceFingerprint(before)).not.toBe(computeSourceFingerprint(after))
    })
  })
})
