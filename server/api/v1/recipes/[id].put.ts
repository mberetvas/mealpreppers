import { getSupabaseServerClient } from '../../../db/supabaseClient'
import { updateRecipe } from '../../../services/recipe-catalog/recipeRepository'
import { recipeUpdatePayloadSchema } from '../../../services/recipe-catalog/recipeSchemas'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')?.trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Recipe id is required.' })
  }

  const parsedPayload = recipeUpdatePayloadSchema.safeParse(await readBody(event))

  if (!parsedPayload.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid recipe payload.', data: parsedPayload.error.flatten() })
  }

  const supabase = getSupabaseServerClient()

  return updateRecipe(supabase, id, parsedPayload.data)
})
