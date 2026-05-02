import { getSupabaseServerClient } from '../../../db/supabaseClient'
import { getRecipeById } from '../../../services/recipe-catalog/recipeRepository'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')?.trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Recipe id is required.' })
  }

  const recipe = await getRecipeById(getSupabaseServerClient(), id)
  if (!recipe) {
    throw createError({ statusCode: 404, statusMessage: 'Recipe not found.' })
  }
  return recipe
})
