import { createError } from 'h3'
import { getDb } from '../../../db/sqlite'
import { DEFAULT_RECIPE_CATEGORIES, DEFAULT_RECIPE_TAGS } from '../../../services/recipe-catalog/recipeDefaults'
import { listStoredRecipeOptions } from '../../../services/recipe-catalog/recipeRepository'

/**
 * Returns distinct categories and tags for use in selection dropdowns.
 * Predefined defaults are merged with any values already stored in the database.
 */
export default defineEventHandler(async () => {
  const result = await listStoredRecipeOptions(getDb())

  if (!result.ok) {
    throw createError({ statusCode: 500, statusMessage: result.error.message })
  }

  const categoriesSet = new Set<string>(DEFAULT_RECIPE_CATEGORIES)
  const tagsSet = new Set<string>(DEFAULT_RECIPE_TAGS)

  for (const category of result.value.categories) {
    categoriesSet.add(category)
  }
  for (const tag of result.value.tags) {
    tagsSet.add(tag)
  }

  return {
    categories: [...categoriesSet].sort((a, b) => a.localeCompare(b)),
    tags: [...tagsSet].sort((a, b) => a.localeCompare(b)),
  }
})
