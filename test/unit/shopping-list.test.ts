import { describe, it, expect } from 'vitest'
import type { RecipeCatalogItem } from '../../types/recipe-catalog-item'
import { collectRecipeOccurrences, buildShoppingList, formatShoppingListIngredient } from '../../utils/shoppingList'
import { emptyWeekPlan } from '../../utils/weekPlan'

const RID_A = '11111111-1111-1111-1111-111111111111'
const RID_B = '22222222-2222-2222-2222-222222222222'
const RID_C = '33333333-3333-3333-3333-333333333333'

function makeRecipe(
  id: string,
  title: string,
  ingredients: RecipeCatalogItem['ingredients'] = [],
): RecipeCatalogItem {
  return {
    id,
    title,
    categories: [],
    tags: [],
    ingredients,
    steps: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  }
}

describe('collectRecipeOccurrences', () => {
  it('returns an empty map for an empty weekplan', () => {
    expect(collectRecipeOccurrences(emptyWeekPlan()).size).toBe(0)
  })

  it('returns count 1 for a recipe appearing once', () => {
    const plan = emptyWeekPlan()
    plan.days['1'].breakfast.recipeId = RID_A
    const result = collectRecipeOccurrences(plan)
    expect(result.get(RID_A)).toBe(1)
    expect(result.size).toBe(1)
  })

  it('returns count 2 for a recipe appearing in two slots', () => {
    const plan = emptyWeekPlan()
    plan.days['1'].breakfast.recipeId = RID_A
    plan.days['3'].lunch.recipeId = RID_A
    expect(collectRecipeOccurrences(plan).get(RID_A)).toBe(2)
  })

  it('skips null slots silently', () => {
    const plan = emptyWeekPlan()
    plan.days['2'].dinner.recipeId = RID_B
    const result = collectRecipeOccurrences(plan)
    expect(result.size).toBe(1)
    expect(result.get(RID_B)).toBe(1)
  })

  it('preserves insertion order (day ascending, breakfast before lunch before dinner)', () => {
    const plan = emptyWeekPlan()
    // Set in non-natural order to confirm iteration order comes from the plan traversal
    plan.days['3'].dinner.recipeId = RID_C
    plan.days['1'].lunch.recipeId = RID_B
    plan.days['1'].breakfast.recipeId = RID_A
    const keys = [...collectRecipeOccurrences(plan).keys()]
    expect(keys).toEqual([RID_A, RID_B, RID_C])
  })
})

describe('buildShoppingList', () => {
  it('multiplies quantity by occurrenceCount for ingredients with a quantity', () => {
    const occurrences = new Map([[RID_A, 3]])
    const recipes = new Map([
      [RID_A, makeRecipe(RID_A, 'Pasta', [
        { id: 'i1', position: 1, rawText: '200g pasta', name: 'pasta', quantity: 200, unit: 'g' },
      ])],
    ])
    const result = buildShoppingList(occurrences, recipes)
    expect(result[0].ingredients[0].quantity).toBe(600)
    expect(result[0].ingredients[0].unit).toBe('g')
  })

  it('leaves quantity undefined and preserves rawText for ingredients without a quantity', () => {
    const occurrences = new Map([[RID_A, 2]])
    const recipes = new Map([
      [RID_A, makeRecipe(RID_A, 'Salad', [
        { id: 'i1', position: 1, rawText: 'a pinch of salt', name: 'salt', quantity: undefined, unit: undefined },
      ])],
    ])
    const section = buildShoppingList(occurrences, recipes)[0]
    expect(section.ingredients[0].quantity).toBeUndefined()
    expect(section.ingredients[0].rawText).toBe('a pinch of salt')
  })

  it('omits a section entirely if the recipe is not present in the recipes map', () => {
    const occurrences = new Map([[RID_A, 1], [RID_B, 1]])
    const recipes = new Map([[RID_A, makeRecipe(RID_A, 'Known')]])
    const result = buildShoppingList(occurrences, recipes)
    expect(result).toHaveLength(1)
    expect(result[0].recipeId).toBe(RID_A)
  })

  it('produces an empty ingredients array for a recipe with no ingredients', () => {
    const occurrences = new Map([[RID_A, 1]])
    const recipes = new Map([[RID_A, makeRecipe(RID_A, 'Empty Recipe')]])
    expect(buildShoppingList(occurrences, recipes)[0].ingredients).toEqual([])
  })

  it('output order matches the insertion order of occurrences', () => {
    const occurrences = new Map([[RID_B, 1], [RID_A, 1]])
    const recipes = new Map([
      [RID_A, makeRecipe(RID_A, 'Recipe A')],
      [RID_B, makeRecipe(RID_B, 'Recipe B')],
    ])
    const result = buildShoppingList(occurrences, recipes)
    expect(result[0].recipeId).toBe(RID_B)
    expect(result[1].recipeId).toBe(RID_A)
  })
})

describe('buildShoppingList — floating-point rounding', () => {
  it('preserves integer quantities without decimal suffix', () => {
    const occurrences = new Map([[RID_A, 3]])
    const recipes = new Map([
      [RID_A, makeRecipe(RID_A, 'Soup', [
        { id: 'i1', position: 1, rawText: '2 carrots', name: 'carrots', quantity: 2, unit: undefined },
      ])],
    ])
    const result = buildShoppingList(occurrences, recipes)
    expect(result[0].ingredients[0].quantity).toBe(6)
    expect(String(result[0].ingredients[0].quantity)).toBe('6')
  })

  it('preserves non-integer quantities that are already clean', () => {
    const occurrences = new Map([[RID_A, 3]])
    const recipes = new Map([
      [RID_A, makeRecipe(RID_A, 'Soup', [
        { id: 'i1', position: 1, rawText: '0.5 l milk', name: 'milk', quantity: 0.5, unit: 'l' },
      ])],
    ])
    const result = buildShoppingList(occurrences, recipes)
    expect(result[0].ingredients[0].quantity).toBe(1.5)
  })

  it('rounds floating-point noise to at most 2 decimal places', () => {
    const occurrences = new Map([[RID_A, 3]])
    const recipes = new Map([
      [RID_A, makeRecipe(RID_A, 'Soup', [
        { id: 'i1', position: 1, rawText: '0.1 l oil', name: 'oil', quantity: 0.1, unit: 'l' },
      ])],
    ])
    const result = buildShoppingList(occurrences, recipes)
    // 0.1 * 3 = 0.30000000000000004 in JS — should round to 0.3
    expect(result[0].ingredients[0].quantity).toBe(0.3)
  })

  it('rounds multi-occurrence scaling that produces FP noise', () => {
    const occurrences = new Map([[RID_A, 7]])
    const recipes = new Map([
      [RID_A, makeRecipe(RID_A, 'Toast', [
        { id: 'i1', position: 1, rawText: '0.1 kg butter', name: 'butter', quantity: 0.1, unit: 'kg' },
        { id: 'i2', position: 2, rawText: '0.2 l cream', name: 'cream', quantity: 0.2, unit: 'l' },
      ])],
    ])
    const result = buildShoppingList(occurrences, recipes)
    // 0.1 * 7 = 0.7000000000000001 → 0.7
    expect(result[0].ingredients[0].quantity).toBe(0.7)
    // 0.2 * 7 = 1.4000000000000001 → 1.4
    expect(result[0].ingredients[1].quantity).toBe(1.4)
  })
})

describe('formatShoppingListIngredient', () => {
  it('preserves a zero quantity when formatting a quantified ingredient', () => {
    expect(formatShoppingListIngredient({
      rawText: '0 g salt',
      name: 'salt',
      quantity: 0,
      unit: 'g',
    })).toBe('0 g salt')
  })

  it('falls back to rawText when quantity is undefined', () => {
    expect(formatShoppingListIngredient({
      rawText: 'a pinch of salt',
      name: 'salt',
      quantity: undefined,
      unit: undefined,
    })).toBe('a pinch of salt')
  })
})
