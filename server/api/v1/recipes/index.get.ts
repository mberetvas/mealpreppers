import { getSupabaseServerClient } from '../../../db/supabaseClient'
import { listRecipes } from '../../../services/recipe-catalog/recipeRepository'
import { handleRecipeUnexpected, toRecipeHttpError } from '../../../utils/recipeErrors'

export default defineEventHandler(async () => {
  try {
    const supabase = getSupabaseServerClient()
    const result = await listRecipes(supabase)
    if (!result.ok) {
      throw createError(toRecipeHttpError(result.error))
    }
    return result.value
  }
  catch (err) {
    handleRecipeUnexpected(err, 'recipes', 'list recipes')
  }
})