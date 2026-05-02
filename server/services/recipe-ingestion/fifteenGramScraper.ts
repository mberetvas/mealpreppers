import type { CheerioAPI } from 'cheerio'
import {
  cleanText,
  parseIngredientLine,
  parseRecipeDuration,
} from './normalizers'
import type { RecipeDraft, RecipeSource } from './recipeScraper'
import { optionalText, parseServings, toRecipeSteps } from './scraperUtils'

/**
 * Parses a 15gram recipe page using microdata attributes.
 * 15gram does not embed JSON-LD; it uses itemprop microdata instead.
 */
export function parseFifteenGramRecipe(document: CheerioAPI, source: RecipeSource): RecipeDraft {
  const title = cleanText(document('[itemprop="name"]').first().text())
  const description = optionalText(document('[itemprop="description"]').first().text())
  const imageUrl = optionalText(document('[itemprop="image"]').first().attr('src'))
  const servings = parseServings(document('[itemprop="recipeYield"]').first().text())
  const cookTimeMinutes = parseRecipeDuration(document('meta[itemprop="cookTime"]').first().attr('content'))
  const ingredients = document('li[itemprop="recipeIngredient"]')
    .toArray()
    .map(element => parseIngredientLine(document(element).text()))
  const steps = toRecipeSteps(document('li[itemprop="recipeInstructions"]')
    .toArray()
    .map(element => document(element).text()))

  return {
    source,
    title,
    description,
    imageUrl,
    servings,
    cookTimeMinutes,
    categories: [],
    tags: [],
    ingredients,
    steps,
  }
}
