import { describe, expect, it } from 'vitest'
import {
  createRecipe,
  deleteRecipesByIds,
  getRecipeById,
  listRecipes,
  listStoredRecipeOptions,
  updateRecipe,
} from '../../server/services/recipe-catalog/recipeRepository'
import { useRecipeCatalogTestDb } from '../helpers/recipeCatalogTestDb'

const samplePayload = {
  title: 'Test Pasta',
  description: 'Quick weeknight meal',
  categories: ['Dinner'],
  tags: ['Pasta'],
  ingredients: [{ rawText: '200g pasta', name: 'pasta', quantity: 200, unit: 'g' }],
  steps: [{ text: 'Boil pasta' }],
}

describe('recipeRepository (SQLite)', () => {
  const testDb = useRecipeCatalogTestDb()

  it('creates, reads, updates, lists, and deletes recipes', async () => {
    const created = await createRecipe(testDb.db, samplePayload)
    expect(created.ok).toBe(true)
    if (!created.ok) {
      return
    }

    const byId = await getRecipeById(testDb.db, created.value.id)
    expect(byId.ok).toBe(true)
    if (byId.ok) {
      expect(byId.value.title).toBe('Test Pasta')
      expect(byId.value.ingredients).toHaveLength(1)
    }

    const listed = await listRecipes(testDb.db)
    expect(listed.ok).toBe(true)
    if (listed.ok) {
      expect(listed.value).toHaveLength(1)
    }

    const updated = await updateRecipe(testDb.db, created.value.id, {
      ...samplePayload,
      title: 'Updated Pasta',
      tags: ['Pasta', 'Quick'],
    })
    expect(updated.ok).toBe(true)
    if (updated.ok) {
      expect(updated.value.title).toBe('Updated Pasta')
      expect(updated.value.tags).toContain('Quick')
    }

    const options = await listStoredRecipeOptions(testDb.db)
    expect(options.ok).toBe(true)
    if (options.ok) {
      expect(options.value.categories).toContain('Dinner')
      expect(options.value.tags).toContain('Quick')
    }

    const deleted = await deleteRecipesByIds(testDb.db, [created.value.id])
    expect(deleted).toEqual({ ok: true, value: 1 })

    const missing = await getRecipeById(testDb.db, created.value.id)
    expect(missing.ok).toBe(false)
    if (!missing.ok) {
      expect(missing.error.kind).toBe('not_found')
    }
  })

  it('deleteRecipesByIds returns ok(0) when ids are empty after trim', async () => {
    const result = await deleteRecipesByIds(testDb.db, ['', '  ', '\t'])
    expect(result).toEqual({ ok: true, value: 0 })
  })
})
