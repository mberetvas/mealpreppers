import { describe, expect, it } from 'vitest'
import type { RecipePreviewResponse } from '../../types/recipe-preview'
import { recipePreviewRequestSchema } from '../../types/recipe-preview.schema'
import type { RecipeScrapeResult } from '../../types/recipe-draft'

describe('recipe preview API contract', () => {
  describe('recipePreviewRequestSchema', () => {
    it('accepts a valid URL string', () => {
      const parsed = recipePreviewRequestSchema.safeParse({
        url: 'https://15gram.be/recepten/demo',
      })
      expect(parsed.success).toBe(true)
    })

    it('rejects a non-URL string', () => {
      const parsed = recipePreviewRequestSchema.safeParse({
        url: 'not-a-url',
      })
      expect(parsed.success).toBe(false)
    })

    it('rejects missing url', () => {
      const parsed = recipePreviewRequestSchema.safeParse({})
      expect(parsed.success).toBe(false)
    })
  })

  it('RecipePreviewResponse matches RecipeScrapeResult shape', () => {
    const minimal: RecipeScrapeResult = {
      draft: {
        source: { url: 'https://15gram.be/x', host: '15gram.be' },
        title: 'T',
        categories: [],
        tags: [],
        ingredients: [{ rawText: 'x', name: 'x' }],
        steps: [{ position: 1, text: 'mix' }],
      },
      warnings: [],
    }
    const asPreview: RecipePreviewResponse = minimal
    expect(asPreview.draft.title).toBe('T')
    expect(asPreview.warnings).toEqual([])
  })
})
