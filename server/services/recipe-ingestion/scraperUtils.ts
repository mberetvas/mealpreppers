import type { CheerioAPI } from 'cheerio'
import {
  cleanText,
  parseIngredientLine,
  parseRecipeDuration,
} from './normalizers'
import type { RecipeDraft, RecipeSource, RecipeStepDraft } from './recipeScraper'

/**
 * Extracts the first JSON-LD node with @type "Recipe" from a Cheerio document.
 * Handles bare-newline JSON (common in Libelle) via a repair fallback.
 */
export function findRecipeJsonLd(document: CheerioAPI): Record<string, unknown> | undefined {
  const scriptElements = document('script[type="application/ld+json"]').toArray()

  for (const scriptElement of scriptElements) {
    const parsed = safeJsonParse(document(scriptElement).contents().text())
    const recipe = findRecipeNode(parsed)

    if (recipe) {
      return recipe
    }
  }

  return undefined
}

/**
 * Builds a RecipeDraft from a standard schema.org JSON-LD Recipe node.
 * Used by every provider that embeds JSON-LD (all except 15gram).
 */
export function parseJsonLdRecipe(document: CheerioAPI, source: RecipeSource, recipe: Record<string, unknown> | undefined): RecipeDraft {
  const title = cleanText(readString(recipe?.name) ?? document('title').first().text())
  const description = optionalText(readString(recipe?.description))
  const imageUrl = optionalText(readImageUrl(recipe?.image))
  const ingredients = readStringArray(recipe?.recipeIngredient ?? recipe?.ingredients).map(parseIngredientLine)
  const instructionTexts = extractInstructionTexts(recipe?.recipeInstructions)

  return {
    source,
    title,
    description,
    imageUrl,
    servings: parseServings(readString(recipe?.recipeYield)),
    totalTimeMinutes: parseRecipeDuration(readString(recipe?.totalTime)),
    prepTimeMinutes: parseRecipeDuration(readString(recipe?.prepTime)),
    cookTimeMinutes: parseRecipeDuration(readString(recipe?.cookTime)),
    categories: uniqueStrings([
      ...splitList(recipe?.recipeCategory),
      ...splitList(recipe?.recipeCuisine),
    ]),
    tags: splitList(recipe?.keywords),
    ingredients,
    steps: toRecipeSteps(instructionTexts),
  }
}

export function toRecipeSteps(values: string[]): RecipeStepDraft[] {
  return values
    .map(cleanText)
    .filter(Boolean)
    .map((text, index) => ({ position: index + 1, text }))
}

export function readString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return value.toString()
  }

  return undefined
}

export function readStringArray(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value]
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap(item => typeof item === 'string' ? [item] : [])
}

export function readImageUrl(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return readImageUrl(value[0])
  }

  if (isRecord(value)) {
    return readString(value.url)
  }

  return undefined
}

export function splitList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueStrings(value.flatMap(splitList))
  }

  if (typeof value !== 'string') {
    return []
  }

  return value
    .split(/[,|]/)
    .map(cleanText)
    .filter(Boolean)
}

export function parseServings(value: string | undefined): number | undefined {
  if (!value) {
    return undefined
  }

  const match = cleanText(value).match(/\d+/)
  return match ? Number.parseInt(match[0], 10) : undefined
}

export function optionalText(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  const cleaned = cleanText(value)
  return cleaned || undefined
}

export function safeJsonParse(value: string | undefined): unknown {
  if (!value) {
    return undefined
  }

  const trimmedValue = value.trim()

  try {
    return JSON.parse(trimmedValue)
  }
  catch {
    try {
      return JSON.parse(escapeBareNewlinesInJsonStrings(trimmedValue))
    }
    catch {
      return undefined
    }
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map(cleanText).filter(Boolean))]
}

export function formatQuantity(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toString().replace('.', ',')
}

function findRecipeNode(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const recipe = findRecipeNode(item)
      if (recipe) {
        return recipe
      }
    }
  }

  if (!isRecord(value)) {
    return undefined
  }

  if (typeIncludes(value['@type'], 'Recipe')) {
    return value
  }

  const graphRecipe = findRecipeNode(value['@graph'])
  if (graphRecipe) {
    return graphRecipe
  }

  return undefined
}

function extractInstructionTexts(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value]
  }

  if (Array.isArray(value)) {
    return value.flatMap(extractInstructionTexts)
  }

  if (!isRecord(value)) {
    return []
  }

  // Prioritise itemListElement/steps so that HowToSection containers (which VRT
  // uses for multi-component recipes and may include a text field as the section
  // heading) recurse into their child steps instead of returning the heading.
  if (value.itemListElement != null || value.steps != null) {
    return extractInstructionTexts(value.itemListElement ?? value.steps)
  }

  if (typeof value.text === 'string') {
    return [value.text]
  }

  return []
}

function escapeBareNewlinesInJsonStrings(value: string): string {
  let escaped = false
  let insideString = false
  let repaired = ''

  for (const character of value) {
    if (character === '"' && !escaped) {
      insideString = !insideString
    }

    if (insideString && (character === '\n' || character === '\r')) {
      repaired += character === '\n' ? '\\n' : '\\r'
    }
    else {
      repaired += character
    }

    escaped = character === '\\' && !escaped
  }

  return repaired
}

function typeIncludes(value: unknown, expectedType: string): boolean {
  return typeof value === 'string'
    ? value === expectedType
    : Array.isArray(value) && value.includes(expectedType)
}
