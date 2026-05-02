import { getSupabaseServerClient } from '../../../db/supabaseClient'
import { createRecipe } from '../../../services/recipe-catalog/recipeRepository'
import { recipeCreatePayloadSchema } from '../../../services/recipe-catalog/recipeSchemas'

export default defineEventHandler(async (event) => {
  const parsedPayload = recipeCreatePayloadSchema.safeParse(await readBody(event))

  if (!parsedPayload.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid recipe payload.', data: parsedPayload.error.flatten() })
  }

  const payload = parsedPayload.data
  const supabase = getSupabaseServerClient()

  return createRecipe(supabase, payload)
})