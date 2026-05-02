import { getSupabaseServerClient } from '../../../db/supabaseClient'
import { listRecipes } from '../../../services/recipe-catalog/recipeRepository'

export default defineEventHandler(() => {
  const supabase = getSupabaseServerClient()

  return listRecipes(supabase)
})