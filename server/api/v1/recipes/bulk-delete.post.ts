import { createError, defineEventHandler, readBody } from 'h3'
import { getDb } from '../../../db/sqlite'
import { useTraceId } from '../../../middleware/01.trace-context'
import { deleteRecipesByIds } from '../../../services/recipe-catalog/recipeRepository'
import { recipeBulkDeleteRequestSchema } from '../../../services/recipe-catalog/recipeSchemas'
import { handleRecipeUnexpected, toRecipeHttpError } from '../../../utils/recipeErrors'

export default defineEventHandler(async (event) => {
  try {
    const parsed = recipeBulkDeleteRequestSchema.safeParse(await readBody(event))

    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid bulk delete payload.',
        data: parsed.error.flatten(),
      })
    }

    const result = await deleteRecipesByIds(getDb(), parsed.data.ids)
    if (!result.ok) {
      throw createError(toRecipeHttpError(result.error))
    }

    return { deleted: result.value }
  }
  catch (err) {
    handleRecipeUnexpected(err, 'recipes', 'bulk delete recipes', useTraceId(event))
  }
})
