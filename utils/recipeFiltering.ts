import type { RecipeCatalogItem } from '~~/types/recipe-catalog-item'

export interface RecipeFilterOptions {
  query: string
  category: string
  tag: string
  sortBy: 'updatedAt' | 'title'
}

export interface RecipePlannerFilterOptions {
  query: string
  category: string
  /** Max total cook time in minutes (inclusive). Omit or `null` for no cap. */
  maxTotalTimeMinutes: number | null
  sortBy: 'updatedAt' | 'title'
}

/**
 * Filters and sorts recipes based on search query, category, tag, and sort preference.
 * Pure function — easy to test without Vue reactivity.
 */
export function filterRecipes(recipes: RecipeCatalogItem[], options: RecipeFilterOptions): RecipeCatalogItem[] {
  const { query, category, tag, sortBy } = options
  const normalizedQuery = query.trim().toLowerCase()

  let results = recipes

  if (normalizedQuery) {
    results = results.filter((recipe) => {
      const searchableText = [
        recipe.title,
        recipe.description,
        recipe.difficulty,
        ...recipe.categories,
        ...recipe.tags,
        ...recipe.ingredients.map(ingredient => ingredient.rawText),
      ].filter(Boolean).join(' ').toLowerCase()

      return searchableText.includes(normalizedQuery)
    })
  }

  if (category) {
    results = results.filter(r => r.categories.includes(category))
  }

  if (tag) {
    results = results.filter(r => r.tags.includes(tag))
  }

  if (sortBy === 'title') {
    results = [...results].sort((a, b) => a.title.localeCompare(b.title))
  }
  else {
    // Optimization: Lexicographical comparison of ISO 8601 strings is ~10x faster than new Date()
    results = [...results].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  return results
}

/**
 * Planner picker: search + category + max total time (recipes without `totalTimeMinutes` pass the filter).
 */
export function filterRecipesForPlanner(recipes: RecipeCatalogItem[], options: RecipePlannerFilterOptions): RecipeCatalogItem[] {
  const { query, category, maxTotalTimeMinutes, sortBy } = options
  const normalizedQuery = query.trim().toLowerCase()

  let results = recipes

  if (normalizedQuery) {
    results = results.filter((recipe) => {
      const searchableText = [
        recipe.title,
        recipe.description,
        recipe.difficulty,
        ...recipe.categories,
        ...recipe.tags,
        ...recipe.ingredients.map(ingredient => ingredient.rawText),
      ].filter(Boolean).join(' ').toLowerCase()

      return searchableText.includes(normalizedQuery)
    })
  }

  if (category) {
    results = results.filter(r => r.categories.includes(category))
  }

  if (maxTotalTimeMinutes != null && maxTotalTimeMinutes > 0) {
    const cap = maxTotalTimeMinutes
    results = results.filter((r) => {
      const t = r.totalTimeMinutes
      if (t == null) return true
      return t <= cap
    })
  }

  if (sortBy === 'title') {
    results = [...results].sort((a, b) => a.title.localeCompare(b.title))
  }
  else {
    // Optimization: Lexicographical comparison of ISO 8601 strings is ~10x faster than new Date()
    results = [...results].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  return results
}

/**
 * Returns the appropriate empty-state message type.
 */
export function emptyStateType(totalCount: number, hasActiveFilters: boolean): 'empty-library' | 'no-matches' {
  if (totalCount === 0) return 'empty-library'
  return hasActiveFilters ? 'no-matches' : 'empty-library'
}
