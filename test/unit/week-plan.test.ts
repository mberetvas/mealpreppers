import { describe, it, expect } from 'vitest'
import type { WeekPlanV1 } from '../../types/planning'
import {
  countAssignedRecipes,
  deepCloneWeek,
  emptyWeekPlan,
  getDuplicateRecipeIds,
  isWeekPlanValid,
} from '../../utils/weekPlan'

const RID_A = '11111111-1111-1111-1111-111111111111'
const RID_B = '22222222-2222-2222-2222-222222222222'

function withRecipe(plan: WeekPlanV1, day: keyof WeekPlanV1['days'], meal: 'breakfast' | 'lunch' | 'dinner', id: string | null): WeekPlanV1 {
  const next = deepCloneWeek(plan)
  next.days[day][meal] = { recipeId: id }
  return next
}

describe('emptyWeekPlan', () => {
  it('has seven days and all slots null', () => {
    const w = emptyWeekPlan()
    expect(w.version).toBe('week_v1')
    expect(countAssignedRecipes(w)).toBe(0)
    expect(isWeekPlanValid(w)).toBe(false)
  })
})

describe('isWeekPlanValid / countAssignedRecipes', () => {
  it('is valid when any slot has a recipe', () => {
    let w = emptyWeekPlan()
    w = withRecipe(w, '1', 'breakfast', RID_A)
    expect(countAssignedRecipes(w)).toBe(1)
    expect(isWeekPlanValid(w)).toBe(true)
  })
})

describe('getDuplicateRecipeIds', () => {
  it('returns ids used in more than one slot', () => {
    let w = emptyWeekPlan()
    w = withRecipe(w, '1', 'breakfast', RID_A)
    w = withRecipe(w, '2', 'dinner', RID_A)
    w = withRecipe(w, '3', 'lunch', RID_B)
    const dupes = getDuplicateRecipeIds(w)
    expect(dupes.has(RID_A)).toBe(true)
    expect(dupes.has(RID_B)).toBe(false)
  })
})

describe('deepCloneWeek', () => {
  it('mutating clone does not affect original', () => {
    const a = withRecipe(emptyWeekPlan(), '4', 'lunch', RID_A)
    const b = deepCloneWeek(a)
    b.days['4'].lunch.recipeId = null
    expect(a.days['4'].lunch.recipeId).toBe(RID_A)
  })
})
