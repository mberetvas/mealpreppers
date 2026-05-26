import { createHash } from 'node:crypto'
import type { WeekPlanV1 } from '../../../types/planning'

const DAY_KEYS = ['1', '2', '3', '4', '5', '6', '7'] as const
const MEAL_KEYS = ['breakfast', 'lunch', 'dinner'] as const

/**
 * Computes a stable canonical digest of a WeekPlanV1 body for shopping list staleness detection.
 * The digest is deterministic regardless of JS object key insertion order:
 * days are iterated 1–7, meals in breakfast→lunch→dinner order, with sorted keys at each level.
 */
export function computeSourceFingerprint(body: WeekPlanV1): string {
  const canonical = buildCanonicalString(body)
  return createHash('sha256').update(canonical).digest('hex')
}

function buildCanonicalString(body: WeekPlanV1): string {
  const parts: string[] = []
  for (const day of DAY_KEYS) {
    for (const meal of MEAL_KEYS) {
      const slot = body.days[day][meal]
      parts.push(`${day}.${meal}=${slot.recipeId ?? ''}`)
    }
  }
  return parts.join('|')
}
