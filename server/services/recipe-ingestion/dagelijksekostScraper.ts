import type { CheerioAPI } from 'cheerio'
import type { RecipeDraft, RecipeSource } from './recipeScraper'
import { findRecipeJsonLd, parseJsonLdRecipe } from './scraperUtils'

/**
 * Parses a Dagelijkse Kost recipe page using standard JSON-LD.
 * No site-specific fallbacks needed; VRT embeds well-formed JSON-LD with prep/cook/total time.
 */
export function parseDagelijksekostRecipe(document: CheerioAPI, source: RecipeSource): RecipeDraft {
  const jsonLdRecipe = findRecipeJsonLd(document)
  return parseJsonLdRecipe(document, source, jsonLdRecipe)
}
