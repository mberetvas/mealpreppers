import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { deleteRecipesByIds } from '../../server/services/recipe-catalog/recipeRepository'

describe('recipeRepository RecipeResult', () => {
  it('deleteRecipesByIds returns ok(0) when ids are empty after trim', async () => {
    const fakeClient = {} as SupabaseClient
    const result = await deleteRecipesByIds(fakeClient, ['', '  ', '\t'])
    expect(result).toEqual({ ok: true, value: 0 })
  })
})
