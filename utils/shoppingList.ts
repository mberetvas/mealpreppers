import type { WeekPlanV1 } from '../types/planning'
import type { RecipeCatalogItem } from '../types/recipe-catalog-item'

export interface ShoppingListIngredient {
  rawText: string
  name: string
  quantity: number | undefined
  unit: string | undefined
}

export interface ShoppingListSection {
  recipeId: string
  recipeTitle: string
  occurrenceCount: number
  ingredients: ShoppingListIngredient[]
}

const DAY_KEYS = ['1', '2', '3', '4', '5', '6', '7'] as const
const MEAL_KEYS = ['breakfast', 'lunch', 'dinner'] as const

/** Returns true when a formatter part should be rendered into an ingredient line. */
function isPresentIngredientPart(part: number | string | null | undefined): part is number | string {
  return part !== undefined && part !== null && part !== ''
}

/**
 * Iterates all 21 meal slots in day-ascending, breakfast→lunch→dinner order,
 * returning an insertion-ordered map of recipeId → occurrenceCount.
 * Null slots are silently skipped.
 */
export function collectRecipeOccurrences(plan: WeekPlanV1): Map<string, number> {
  const occurrences = new Map<string, number>()
  for (const day of DAY_KEYS) {
    for (const meal of MEAL_KEYS) {
      const id = plan.days[day][meal].recipeId
      if (!id) continue
      occurrences.set(id, (occurrences.get(id) ?? 0) + 1)
    }
  }
  return occurrences
}

/**
 * Builds a shopping list from a recipe occurrence map and a recipe catalog.
 * Preserves the insertion order of `occurrences`. Recipes absent from the catalog
 * are omitted. Ingredient quantities are multiplied by occurrenceCount; ingredients
 * without a quantity keep quantity undefined and rawText unchanged.
 */
export function buildShoppingList(
  occurrences: Map<string, number>,
  recipes: Map<string, RecipeCatalogItem>,
): ShoppingListSection[] {
  const sections: ShoppingListSection[] = []
  for (const [recipeId, occurrenceCount] of occurrences) {
    const recipe = recipes.get(recipeId)
    if (!recipe) continue
    const ingredients: ShoppingListIngredient[] = recipe.ingredients.map(ing => ({
      rawText: ing.rawText,
      name: ing.name,
      quantity: ing.quantity !== undefined ? ing.quantity * occurrenceCount : undefined,
      unit: ing.unit,
    }))
    sections.push({ recipeId, recipeTitle: recipe.title, occurrenceCount, ingredients })
  }
  return sections
}

/** Formats an ingredient as quantity-unit-name when quantity exists, otherwise rawText. */
export function formatShoppingListIngredient(ingredient: ShoppingListIngredient): string {
  if (ingredient.quantity === undefined) {
    return ingredient.rawText
  }

  return [ingredient.quantity, ingredient.unit, ingredient.name]
    .filter(isPresentIngredientPart)
    .join(' ')
}
