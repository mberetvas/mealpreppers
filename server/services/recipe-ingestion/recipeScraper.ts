import { load } from 'cheerio'
import type { RecipeDraft, RecipeScrapeResult, RecipeSource, SupportedRecipeHost } from '../../../types/recipe-draft'
import { parseFifteenGramRecipe } from './fifteenGramScraper'
import { parseColruytRecipe } from './colruytScraper'
import { parseDagelijksekostRecipe } from './dagelijksekostScraper'
import { parseDelhaizeRecipe } from './delhaizeScraper'
import { parseLibelleLekkerRecipe } from './libelleLekkerScraper'

export type {
  RecipeDraft,
  RecipeIngredientDraft,
  RecipeScrapeResult,
  RecipeSource,
  RecipeStepDraft,
  SupportedRecipeHost,
} from '../../../types/recipe-draft'

const SUPPORTED_HOSTS: SupportedRecipeHost[] = [
  '15gram.be',
  'colruyt.be',
  'dagelijksekost.vrt.be',
  'delhaize.be',
  'libelle-lekker.be',
]

const PROVIDER_PARSERS: Record<SupportedRecipeHost, typeof parseFifteenGramRecipe> = {
  '15gram.be': parseFifteenGramRecipe,
  'colruyt.be': parseColruytRecipe,
  'dagelijksekost.vrt.be': parseDagelijksekostRecipe,
  'delhaize.be': parseDelhaizeRecipe,
  'libelle-lekker.be': parseLibelleLekkerRecipe,
}

export function isSupportedRecipeUrl(value: string): boolean {
  return canonicalRecipeHost(value) !== undefined
}

export function canonicalRecipeHost(value: string): SupportedRecipeHost | undefined {
  try {
    const url = new URL(value)

    if (url.protocol !== 'https:') {
      return undefined
    }

    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    return SUPPORTED_HOSTS.find(supportedHost => supportedHost === host)
  }
  catch {
    return undefined
  }
}

export function parseRecipeHtml(html: string, sourceUrl: string): RecipeScrapeResult {
  const host = canonicalRecipeHost(sourceUrl)

  if (!host) {
    throw new Error(`Unsupported recipe source: ${sourceUrl}`)
  }

  const source: RecipeSource = { url: sourceUrl, host }
  const document = load(html)
  const parse = PROVIDER_PARSERS[host]
  const draft = parse(document, source)

  const warnings = draft.steps.length === 0 ? ['No preparation steps found for this recipe.'] : []

  return { draft, warnings }
}
