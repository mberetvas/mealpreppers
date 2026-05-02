import { getSupabaseServerClient } from '../../../db/supabaseClient'
import { deleteRecipesByIds } from '../../../services/recipe-catalog/recipeRepository'
import { recipeBulkDeleteRequestSchema } from '../../../services/recipe-catalog/recipeSchemas'

export default defineEventHandler(async (event) => {
  const parsed = recipeBulkDeleteRequestSchema.safeParse(await readBody(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid bulk delete payload.',
      data: parsed.error.flatten(),
    })
  }

  const supabase = getSupabaseServerClient()
  const deleted = await deleteRecipesByIds(supabase, parsed.data.ids)

  return { deleted }
})
