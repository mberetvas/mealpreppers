import type { MonthPlanV1, WeekPlanV1 } from '~~/types/planning'

const DAY_KEYS = ['1', '2', '3', '4', '5', '6', '7'] as const

function emptyDay(): WeekPlanV1['days']['1'] {
  return {
    breakfast: { recipeId: null },
    lunch: { recipeId: null },
    dinner: { recipeId: null },
  }
}

/** Canonical empty week document (`week_v1`). */
export function emptyWeekPlan(): WeekPlanV1 {
  return {
    version: 'week_v1',
    days: {
      '1': emptyDay(),
      '2': emptyDay(),
      '3': emptyDay(),
      '4': emptyDay(),
      '5': emptyDay(),
      '6': emptyDay(),
      '7': emptyDay(),
    },
  }
}

/** Four-week horizon document (`month_v1`). */
export function emptyMonthPlan(): MonthPlanV1 {
  return {
    version: 'month_v1',
    weeks: [null, null, null, null],
  }
}

/** Counts assigned recipe slots (non-null `recipeId`) in the week. */
export function countAssignedRecipes(plan: WeekPlanV1): number {
  let n = 0
  for (const k of DAY_KEYS) {
    const d = plan.days[k]
    for (const slot of [d.breakfast, d.lunch, d.dinner]) {
      if (slot.recipeId) n++
    }
  }
  return n
}

/** Product rule: at least one recipe slot must be filled. */
export function isWeekPlanValid(plan: WeekPlanV1): boolean {
  return countAssignedRecipes(plan) >= 1
}

/**
 * Recipe ids that appear in more than one slot (nulls ignored).
 * Used for duplicate warnings in the UI.
 */
export function getDuplicateRecipeIds(plan: WeekPlanV1): Set<string> {
  const seen = new Map<string, number>()
  for (const k of DAY_KEYS) {
    const d = plan.days[k]
    for (const slot of [d.breakfast, d.lunch, d.dinner]) {
      const id = slot.recipeId
      if (!id) continue
      seen.set(id, (seen.get(id) ?? 0) + 1)
    }
  }
  const dupes = new Set<string>()
  for (const [id, count] of seen) {
    if (count > 1) dupes.add(id)
  }
  return dupes
}

/** Deep clone for month snapshots (plain JSON data). */
export function deepCloneWeek(plan: WeekPlanV1): WeekPlanV1 {
  return JSON.parse(JSON.stringify(plan)) as WeekPlanV1
}
