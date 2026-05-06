import { consola } from 'consola'
import { recipePreviewRequestSchema } from '../../../services/recipe-catalog/recipeSchemas'
import { previewRecipeFromUrl } from '../../../services/recipe-ingestion/recipePreview/previewRecipeFromUrl'
import { RecipePublisherAuthWallError, RecipePreviewDomainError } from '../../../services/recipe-ingestion/recipePreview/recipePreviewErrors'

const previewLogger = consola.withTag('recipe-preview')

export default defineEventHandler(async (event) => {
  const parsedBody = recipePreviewRequestSchema.safeParse(await readBody(event))

  if (!parsedBody.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid recipe preview request.', data: parsedBody.error.flatten() })
  }

  try {
    return await previewRecipeFromUrl(parsedBody.data.url)
  }
  catch (error) {
    if (error instanceof RecipePublisherAuthWallError) {
      previewLogger.warn('Recipe preview blocked by publisher auth wall', {
        requestedUrl: error.diagnostics.requestedUrl,
        finalUrl: error.diagnostics.finalUrl,
        status: error.diagnostics.status,
      })
    }

    if (error instanceof RecipePreviewDomainError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }

    throw error
  }
})
