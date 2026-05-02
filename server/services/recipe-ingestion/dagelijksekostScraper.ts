import type { CheerioAPI } from 'cheerio'
import { cleanText } from './normalizers'
import type { RecipeDraft, RecipeSource } from './recipeScraper'
import { findRecipeJsonLd, parseJsonLdRecipe, readString } from './scraperUtils'

/**
 * VRT sets `name` in JSON-LD to a long "Jeroen Meus deelt / maakt..." SEO style string.
 * The real dish title is in `og:title` and matches what users see.
 */
function pickDagelijkseKostTitle(document: CheerioAPI, jsonLdName: string | undefined): string {
  const og = document('meta[property="og:title"]').attr('content')?.trim()
  if (og) {
    return cleanText(og)
  }
  const twitter = document('meta[name="twitter:title"]').attr('content')?.trim()
  if (twitter) {
    return cleanText(twitter)
  }
  const pageTitle = document('title').first().text()
  const stripped = pageTitle.replace(/\s*\|\s*Dagelijkse kost\s*$/i, '').trim()
  if (stripped) {
    return cleanText(stripped)
  }
  return cleanText(jsonLdName ?? pageTitle)
}

/**
 * Parses a Dagelijkse Kost recipe page using JSON-LD for data fields; title comes from
 * `og:title` (or &lt;title&gt;) so it matches the recipe name, not the JSON-LD `name` blurb.
 */
export function parseDagelijksekostRecipe(document: CheerioAPI, source: RecipeSource): RecipeDraft {
  const jsonLdRecipe = findRecipeJsonLd(document)
  const draft = parseJsonLdRecipe(document, source, jsonLdRecipe)
  const nameFromLd = readString(jsonLdRecipe?.name)
  return {
    ...draft,
    title: pickDagelijkseKostTitle(document, nameFromLd),
  }
}
