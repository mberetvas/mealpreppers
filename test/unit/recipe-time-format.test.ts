import { describe, expect, it } from 'vitest'
import type { RecipeCatalogItem } from '../../types/recipe-catalog-item'
import { formatRecipeTime, primaryRecipeMeta } from '../../app/utils/recipeTimeFormat'

function recipe(partial: Partial<RecipeCatalogItem> & Pick<RecipeCatalogItem, 'id' | 'title'>): RecipeCatalogItem {
  return {
    id: partial.id,
    title: partial.title,
    description: partial.description,
    sourceUrl: partial.sourceUrl,
    sourceHost: partial.sourceHost,
    imageUrl: partial.imageUrl,
    servings: partial.servings,
    prepTimeMinutes: partial.prepTimeMinutes,
    cookTimeMinutes: partial.cookTimeMinutes,
    totalTimeMinutes: partial.totalTimeMinutes,
    difficulty: partial.difficulty,
    categories: partial.categories ?? [],
    tags: partial.tags ?? [],
    ingredients: partial.ingredients ?? [],
    steps: partial.steps ?? [],
    createdAt: partial.createdAt ?? '',
    updatedAt: partial.updatedAt ?? '',
  }
}

describe('formatRecipeTime', () => {
  it('uses total time when set', () => {
    const r = recipe({ id: '1', title: 'T', totalTimeMinutes: 30 })
    expect(formatRecipeTime(r)).toBe('30 min')
  })

  it('falls back to prep + cook when total missing', () => {
    const r = recipe({ id: '1', title: 'T', prepTimeMinutes: 5, cookTimeMinutes: 10 })
    expect(formatRecipeTime(r)).toBe('15 min')
  })

  it('returns undefined when no time fields', () => {
    const r = recipe({ id: '1', title: 'T' })
    expect(formatRecipeTime(r)).toBeUndefined()
  })
})

describe('primaryRecipeMeta', () => {
  it('joins time, servings, and difficulty in order', () => {
    const r = recipe({
      id: '1',
      title: 'T',
      totalTimeMinutes: 20,
      servings: 4,
      difficulty: 'Easy',
    })
    expect(primaryRecipeMeta(r)).toEqual(['20 min', '4 servings', 'Easy'])
  })
})
