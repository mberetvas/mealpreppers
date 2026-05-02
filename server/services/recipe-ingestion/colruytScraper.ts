import type { CheerioAPI } from 'cheerio'
import type { RecipeDraft, RecipeSource } from './recipeScraper'
import { findRecipeJsonLd, parseJsonLdRecipe } from './scraperUtils'

/**
 * Parses a Colruyt recipe page using standard JSON-LD.
 * No site-specific fallbacks needed; Colruyt embeds well-formed JSON-LD.
 */
export function parseColruytRecipe(document: CheerioAPI, source: RecipeSource): RecipeDraft {
  const jsonLdRecipe = findRecipeJsonLd(document)
  return parseJsonLdRecipe(document, source, jsonLdRecipe)
}
