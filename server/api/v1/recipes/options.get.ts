import { getSupabaseServerClient } from '../../../db/supabaseClient'

/**
 * Returns distinct categories and tags across all recipes for use in selection dropdowns.
 */
export default defineEventHandler(async () => {
  const supabase = getSupabaseServerClient()

  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('categories, tags')

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message ?? 'Could not load recipe options.' })
  }

  const categoriesSet = new Set<string>()
  const tagsSet = new Set<string>()

  for (const recipe of recipes ?? []) {
    for (const cat of (recipe as { categories: string[], tags: string[] }).categories) {
      categoriesSet.add(cat)
    }
    for (const tag of (recipe as { categories: string[], tags: string[] }).tags) {
      tagsSet.add(tag)
    }
  }

  return {
    categories: [...categoriesSet].sort((a, b) => a.localeCompare(b)),
    tags: [...tagsSet].sort((a, b) => a.localeCompare(b)),
  }
})
