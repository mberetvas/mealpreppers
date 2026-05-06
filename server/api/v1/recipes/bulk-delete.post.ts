import { getSupabaseServerClient } from '../../../db/supabaseClient'
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

    const supabase = getSupabaseServerClient()
    const result = await deleteRecipesByIds(supabase, parsed.data.ids)
    if (!result.ok) {
      throw createError(toRecipeHttpError(result.error))
    }

    return { deleted: result.value }
  }
  catch (err) {
    handleRecipeUnexpected(err, 'recipes', 'bulk delete recipes')
  }
})
