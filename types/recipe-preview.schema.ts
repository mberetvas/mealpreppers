import { z } from 'zod'

/** Validates POST /api/v1/recipes/preview body; single source of truth for preview URL input. */
export const recipePreviewRequestSchema = z.object({
  url: z.string().url(),
})

export type RecipePreviewRequest = z.infer<typeof recipePreviewRequestSchema>
