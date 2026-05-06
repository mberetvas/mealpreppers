import { getSupabaseServerClient } from '../../../db/supabaseClient'
import { getRecipeById } from '../../../services/recipe-catalog/recipeRepository'
import { handleRecipeUnexpected, toRecipeHttpError } from '../../../utils/recipeErrors'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')?.trim()
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Recipe id is required.' })
    }

    const result = await getRecipeById(getSupabaseServerClient(), id)
    if (!result.ok) {
      throw createError(toRecipeHttpError(result.error))
    }
    return result.value
  }
  catch (err) {
    handleRecipeUnexpected(err, 'recipes', 'get recipe by id')
  }
})
