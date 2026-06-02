import type { CheerioAPI } from 'cheerio'
import {
  cleanText,
  parseIngredientLine,
  parseRecipeDuration,
} from './normalizers'
import type { RecipeDraft, RecipeSource } from './recipeScraper'
import { optionalText, parseServings, toRecipeSteps, uniqueStrings } from './scraperUtils'

/**
 * Reads category, cuisine, and keyword labels from the sidebar tag list (avoids unrelated keyword nodes elsewhere on the page).
 */
function readFifteenGramTaxonomy(document: CheerioAPI): { categories: string[], tags: string[] } {
  const tagSidebar = document('#recipe-detail #tags')
  const scoped = tagSidebar.length > 0 ? tagSidebar : document('#recipe-detail .tags-elements')

  const categoryLabels = scoped
    .find('[itemprop="recipeCategory"], [itemprop="recipeCuisine"]')
    .toArray()
    .map(element => cleanText(document(element).text()))

  const keywordLabels = scoped
    .find('[itemprop="keywords"]')
    .toArray()
    .map(element => cleanText(document(element).text()))

  return {
    categories: uniqueStrings(categoryLabels),
    tags: uniqueStrings(keywordLabels),
  }
}

/**
 * Parses a 15gram recipe page using microdata attributes.
 * 15gram does not embed JSON-LD; it uses itemprop microdata instead.
 */
export function parseFifteenGramRecipe(document: CheerioAPI, source: RecipeSource): RecipeDraft {
  const recipeRoot = document('#recipe-detail')
  const scoped = recipeRoot.length > 0 ? recipeRoot : document.root()

  const title = cleanText(scoped.find('[itemprop="name"]').first().text())
  const description = optionalText(scoped.find('[itemprop="description"]').first().text())
  const imageUrl = optionalText(scoped.find('[itemprop="image"]').first().attr('src'))
  const servings = parseServings(scoped.find('[itemprop="recipeYield"]').first().text())
  const cookTimeMinutes = parseRecipeDuration(scoped.find('meta[itemprop="cookTime"]').first().attr('content'))
  const ingredients = scoped.find('li[itemprop="recipeIngredient"]')
    .toArray()
    .map(element => parseIngredientLine(document(element).text()))
  const steps = toRecipeSteps(scoped.find('li[itemprop="recipeInstructions"]')
    .toArray()
    .map(element => document(element).text()))
  const { categories, tags } = readFifteenGramTaxonomy(document)

  return {
    source,
    title,
    description,
    imageUrl,
    servings,
    cookTimeMinutes,
    categories,
    tags,
    ingredients,
    steps,
  }
}
