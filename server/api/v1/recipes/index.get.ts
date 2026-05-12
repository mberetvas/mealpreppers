import { createError, defineEventHandler } from 'h3'
import { getSupabaseServerClient } from '../../../db/supabaseClient'
import { useTraceId } from '../../../middleware/01.trace-context'
import { listRecipes } from '../../../services/recipe-catalog/recipeRepository'
import { handleRecipeUnexpected, toRecipeHttpError } from '../../../utils/recipeErrors'

export default defineEventHandler(async (event) => {
  try {
    const supabase = getSupabaseServerClient()
    const result = await listRecipes(supabase)
    if (!result.ok) {
      throw createError(toRecipeHttpError(result.error))
    }
    return result.value
  }
  catch (err) {
    handleRecipeUnexpected(err, 'recipes', 'list recipes', useTraceId(event))
  }
})