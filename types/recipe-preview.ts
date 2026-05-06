/**
 * Request/response contract for POST /api/v1/recipes/preview; shared by Nitro handler and client.
 */

import type { RecipeScrapeResult } from './recipe-draft'

export type { RecipePreviewRequest } from './recipe-preview.schema'
export { recipePreviewRequestSchema } from './recipe-preview.schema'

/** Response body; alias of scrape result so preview and ingestion stay aligned. */
export type RecipePreviewResponse = RecipeScrapeResult
