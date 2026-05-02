import { describe, expect, it } from 'vitest'
import { RECIPE_IMAGE_MAX_BYTES, validateRecipeImageFile } from '../../app/utils/recipeImageValidation'

describe('validateRecipeImageFile', () => {
  it('rejects empty files', () => {
    const r = validateRecipeImageFile('image/jpeg', 0)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.statusMessage).toMatch(/empty/i)
    }
  })

  it('rejects files over the max size', () => {
    const r = validateRecipeImageFile('image/png', RECIPE_IMAGE_MAX_BYTES + 1)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.statusMessage).toMatch(/5MB/i)
    }
  })

  it('rejects disallowed mime types', () => {
    const r = validateRecipeImageFile('application/pdf', 100)
    expect(r.ok).toBe(false)
  })

  it('accepts allowed image types within size', () => {
    expect(validateRecipeImageFile('image/jpeg', 1024).ok).toBe(true)
    expect(validateRecipeImageFile('image/webp', RECIPE_IMAGE_MAX_BYTES).ok).toBe(true)
  })
})
