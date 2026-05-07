import { recipePreviewRequestSchema } from '../../../services/recipe-catalog/recipeSchemas'
import { previewRecipeFromUrl } from '../../../services/recipe-ingestion/recipePreviewApp'
import { RecipePublisherAuthWallError, RecipePreviewDomainError } from '../../../services/recipe-ingestion/recipePreview/recipePreviewErrors'
import { appLogger } from '../../../utils/logger'
import { useStructuredLogger } from '../../../utils/structuredLogger'
import { useTraceId } from '../../../middleware/01.trace-context'

export default defineEventHandler(async (event) => {
  const traceId = useTraceId(event)
  const parsedBody = recipePreviewRequestSchema.safeParse(await readBody(event))

  if (!parsedBody.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid recipe preview request.', data: parsedBody.error.flatten() })
  }

  try {
    return await previewRecipeFromUrl(parsedBody.data.url)
  }
  catch (error) {
    if (error instanceof RecipePublisherAuthWallError) {
      useStructuredLogger(appLogger.withTag('recipe-preview'), traceId).warn('recipe_preview.auth_wall_blocked', {
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
