/**
 * Request/response contract for POST /api/v1/recipes/preview; shared by Nitro handler and client.
 */

import type { RecipeDraft } from './recipe-draft'

export interface RecipePreviewRequest {
  url: string
}

export interface RecipePreviewResponse {
  draft: RecipeDraft
  warnings: string[]
}
