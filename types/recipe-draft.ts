/**
 * Parsed recipe shape used by scrapers and recipe preview API; shared by server ingestion and Nuxt UI.
 */

export type SupportedRecipeHost = '15gram.be' | 'colruyt.be' | 'dagelijksekost.vrt.be' | 'delhaize.be' | 'libelle-lekker.be'

export interface RecipeIngredientDraft {
  rawText: string
  name: string
  quantity?: number
  unit?: string
}

export interface RecipeSource {
  url: string
  host: SupportedRecipeHost
}

export interface RecipeStepDraft {
  position: number
  text: string
}

export interface RecipeDraft {
  source: RecipeSource
  title: string
  description?: string
  imageUrl?: string
  servings?: number
  totalTimeMinutes?: number
  prepTimeMinutes?: number
  cookTimeMinutes?: number
  difficulty?: string
  categories: string[]
  tags: string[]
  ingredients: RecipeIngredientDraft[]
  steps: RecipeStepDraft[]
}

export interface RecipeScrapeResult {
  draft: RecipeDraft
  warnings: string[]
}
