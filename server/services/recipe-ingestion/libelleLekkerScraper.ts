import type { CheerioAPI } from 'cheerio'
import {
  cleanText,
  decodeHtmlEntities,
  parseLocalizedNumber,
  type RecipeIngredientDraft,
} from './normalizers'
import type { RecipeDraft, RecipeSource } from './recipeScraper'
import {
  findRecipeJsonLd,
  formatQuantity,
  isRecord,
  optionalText,
  parseJsonLdRecipe,
  readString,
  safeJsonParse,
} from './scraperUtils'

/**
 * Parses a Libelle Lekker recipe page.
 * Uses JSON-LD as the base, then overrides ingredients with structured
 * `data-ingredient-groups` HTML attributes when available (more precise
 * quantities and unit names than the loose JSON-LD ingredient strings).
 */
export function parseLibelleLekkerRecipe(document: CheerioAPI, source: RecipeSource): RecipeDraft {
  const jsonLdRecipe = findRecipeJsonLd(document)
  let draft = parseJsonLdRecipe(document, source, jsonLdRecipe)

  const structuredIngredients = parseLibelleStructuredIngredients(document)
  if (structuredIngredients.length > 0) {
    draft = { ...draft, ingredients: structuredIngredients }
  }

  return draft
}

function parseLibelleStructuredIngredients(document: CheerioAPI): RecipeIngredientDraft[] {
  const encodedGroups = document('[data-ingredient-groups]').first().attr('data-ingredient-groups')
  const decodedGroups = encodedGroups ? decodeHtmlEntities(encodedGroups) : undefined
  const parsedGroups = safeJsonParse(decodedGroups)

  if (!Array.isArray(parsedGroups)) {
    return []
  }

  return parsedGroups.flatMap((group) => {
    if (!isRecord(group) || !Array.isArray(group.ingredients)) {
      return []
    }

    return group.ingredients
      .filter(isRecord)
      .map((ingredient) => {
        const quantity = parseLocalizedNumber(readString(ingredient.quantity))
        const unit = optionalText(readString(ingredient.unitName))
        const name = cleanText(readString(ingredient.ingredientName) ?? '')
        const rawText = cleanText([
          quantity && quantity > 0 ? formatQuantity(quantity) : undefined,
          unit,
          name,
        ].filter(Boolean).join(' '))

        return {
          rawText: rawText || name,
          name,
          quantity: quantity && quantity > 0 ? quantity : undefined,
          unit,
        }
      })
  })
}
