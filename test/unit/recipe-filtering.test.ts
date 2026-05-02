import { describe, it, expect } from 'vitest'
import { filterRecipes, emptyStateType } from '../../utils/recipeFiltering'
import type { RecipeCatalogItem } from '../../types/recipe-catalog-item'

function makeRecipe(overrides: Partial<RecipeCatalogItem> = {}): RecipeCatalogItem {
  return {
    id: 'r1',
    title: 'Spaghetti Bolognese',
    description: 'Classic Italian pasta',
    categories: ['Italian'],
    tags: ['pasta', 'comfort'],
    ingredients: [
      { id: 'i1', position: 1, rawText: '500g minced beef', name: 'minced beef', quantity: 500, unit: 'g' },
    ],
    steps: [{ id: 's1', position: 1, text: 'Cook pasta' }],
    difficulty: 'Easy',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-03-01T00:00:00Z',
    ...overrides,
  }
}

const recipes: RecipeCatalogItem[] = [
  makeRecipe({ id: 'r1', title: 'Spaghetti Bolognese', categories: ['Italian'], tags: ['pasta'], updatedAt: '2025-03-01T00:00:00Z' }),
  makeRecipe({ id: 'r2', title: 'Apple Pie', categories: ['Dessert'], tags: ['baking'], difficulty: 'Medium', updatedAt: '2025-04-01T00:00:00Z' }),
  makeRecipe({ id: 'r3', title: 'Caesar Salad', categories: ['Salads', 'Italian'], tags: ['healthy'], difficulty: 'Easy', updatedAt: '2025-02-01T00:00:00Z' }),
]

describe('filterRecipes', () => {
  it('returns all recipes when no filters active', () => {
    const result = filterRecipes(recipes, { query: '', category: '', tag: '', sortBy: 'updatedAt' })
    expect(result).toHaveLength(3)
  })

  it('filters by search query (title)', () => {
    const result = filterRecipes(recipes, { query: 'apple', category: '', tag: '', sortBy: 'updatedAt' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('r2')
  })

  it('filters by search query (ingredient rawText)', () => {
    const result = filterRecipes(recipes, { query: 'minced beef', category: '', tag: '', sortBy: 'updatedAt' })
    expect(result).toHaveLength(3) // all share that ingredient via makeRecipe default
  })

  it('filters by category', () => {
    const result = filterRecipes(recipes, { query: '', category: 'Italian', tag: '', sortBy: 'updatedAt' })
    expect(result).toHaveLength(2)
    expect(result.map(r => r.id).sort()).toEqual(['r1', 'r3'])
  })

  it('filters by tag', () => {
    const result = filterRecipes(recipes, { query: '', category: '', tag: 'baking', sortBy: 'updatedAt' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('r2')
  })

  it('combines query + category', () => {
    const result = filterRecipes(recipes, { query: 'salad', category: 'Italian', tag: '', sortBy: 'updatedAt' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('r3')
  })

  it('returns empty array when nothing matches', () => {
    const result = filterRecipes(recipes, { query: 'nonexistent', category: '', tag: '', sortBy: 'updatedAt' })
    expect(result).toHaveLength(0)
  })

  it('sorts by updatedAt descending (default)', () => {
    const result = filterRecipes(recipes, { query: '', category: '', tag: '', sortBy: 'updatedAt' })
    expect(result.map(r => r.id)).toEqual(['r2', 'r1', 'r3'])
  })

  it('sorts by title A-Z', () => {
    const result = filterRecipes(recipes, { query: '', category: '', tag: '', sortBy: 'title' })
    expect(result.map(r => r.id)).toEqual(['r2', 'r3', 'r1'])
  })

  it('is case-insensitive for search', () => {
    const result = filterRecipes(recipes, { query: 'SPAGHETTI', category: '', tag: '', sortBy: 'updatedAt' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('r1')
  })
})

describe('emptyStateType', () => {
  it('returns empty-library when total count is 0', () => {
    expect(emptyStateType(0, false)).toBe('empty-library')
    expect(emptyStateType(0, true)).toBe('empty-library')
  })

  it('returns no-matches when filters are active and library has recipes', () => {
    expect(emptyStateType(5, true)).toBe('no-matches')
  })

  it('returns empty-library when no filters active even with recipes', () => {
    expect(emptyStateType(5, false)).toBe('empty-library')
  })
})
