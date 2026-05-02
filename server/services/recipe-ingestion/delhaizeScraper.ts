import type { CheerioAPI } from 'cheerio'
import {
  cleanText,
  parseLocalizedNumber,
  parseRecipeDuration,
  type RecipeIngredientDraft,
} from './normalizers'
import type { RecipeDraft, RecipeSource } from './recipeScraper'
import {
  findRecipeJsonLd,
  isRecord,
  optionalText,
  parseJsonLdRecipe,
  readString,
  safeJsonParse,
  splitList,
  uniqueStrings,
} from './scraperUtils'

/**
 * Parses a Delhaize recipe page.
 * Uses JSON-LD as the base, then merges richer data from the embedded
 * `__NEXT_DATA__` script (Apollo/Next.js state) which contains structured
 * `RecipeEssentialData` with `FractionalRecipeIngredient` entries.
 * Delhaize pages often have no preparation instructions in either source.
 */
export function parseDelhaizeRecipe(document: CheerioAPI, source: RecipeSource): RecipeDraft {
  const jsonLdRecipe = findRecipeJsonLd(document)
  let draft = parseJsonLdRecipe(document, source, jsonLdRecipe)
  draft = mergeDelhaizeEmbeddedData(document, draft)
  return draft
}

function mergeDelhaizeEmbeddedData(document: CheerioAPI, draft: RecipeDraft): RecipeDraft {
  const nextDataText = document('script#__NEXT_DATA__').first().contents().text()
  const nextData = safeJsonParse(nextDataText)
  const recipeData = findRecordByTypename(nextData, 'RecipeEssentialData')

  if (!recipeData) {
    return draft
  }

  const ingredients = parseDelhaizeIngredients(recipeData)

  return {
    ...draft,
    title: cleanText(readString(recipeData.title) ?? draft.title),
    servings: parseLocalizedNumber(readString(recipeData.servings)) ?? draft.servings,
    difficulty: optionalText(readString(recipeData.difficultyName)) ?? draft.difficulty,
    prepTimeMinutes: draft.prepTimeMinutes ?? parseRecipeDuration(readString(recipeData.preparationTimeName)),
    categories: uniqueStrings([
      ...draft.categories,
      ...splitList(recipeData.courseName),
      ...splitList(recipeData.cuisine),
    ]),
    ingredients: ingredients.length > 0 ? ingredients : draft.ingredients,
  }
}

function parseDelhaizeIngredients(recipeData: Record<string, unknown>): RecipeIngredientDraft[] {
  const ingredients = Array.isArray(recipeData.fractionalRecipeIngredients) ? recipeData.fractionalRecipeIngredients : []

  return ingredients
    .filter(isRecord)
    .filter(ingredient => typeof ingredient.ingredientName === 'string')
    .map((ingredient) => {
      const quantityText = readString(ingredient.quantity)
      const unit = optionalText(readString(ingredient.measureUnit))
      const name = cleanText(readString(ingredient.ingredientName) ?? '')
      const rawText = cleanText([quantityText, unit, name].filter(Boolean).join(' '))
      const quantity = parseLocalizedNumber(quantityText)

      return {
        rawText: rawText || name,
        name,
        quantity,
        unit,
      }
    })
}

function findRecordByTypename(value: unknown, typename: string): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const record = findRecordByTypename(item, typename)
      if (record) {
        return record
      }
    }
  }

  if (!isRecord(value)) {
    return undefined
  }

  if (value.__typename === typename && typeof value.title === 'string') {
    return value
  }

  for (const childValue of Object.values(value)) {
    const record = findRecordByTypename(childValue, typename)
    if (record) {
      return record
    }
  }

  return undefined
}
