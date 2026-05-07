import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  LIST_IMAGE_LOADING_STRATEGY_LABEL,
  LIST_IMAGE_STRATEGY_SURFACE_FILES,
  LIST_RECIPE_NON_CRITICAL_IMAGE_ATTRS,
  recipeIdentityListImageAlt,
} from '../../app/constants/listImageLoadingStrategy'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

describe(LIST_IMAGE_LOADING_STRATEGY_LABEL, () => {
  it('documents non-critical list thumb performance defaults', () => {
    expect(LIST_RECIPE_NON_CRITICAL_IMAGE_ATTRS).toEqual({
      loading: 'lazy',
      decoding: 'async',
      fetchpriority: 'low',
    })
  })

  it('exposes recipe identity alt copy for catalog-style imagery', () => {
    expect(recipeIdentityListImageAlt('Miso soup')).toBe('Photo of Miso soup')
  })

  for (const relative of LIST_IMAGE_STRATEGY_SURFACE_FILES) {
    it(`${relative} applies shared list image attrs import`, () => {
      const fullPath = join(repoRoot, relative)
      const source = readFileSync(fullPath, 'utf8')
      expect(source).toContain('LIST_RECIPE_NON_CRITICAL_IMAGE_ATTRS')
      expect(source).toContain('~/constants/listImageLoadingStrategy')
    })
  }

  it('keeps catalog grid media frame aspect-locked for load stability', () => {
    const fullPath = join(repoRoot, 'app/components/recipe/RecipeCatalogGridCard.vue')
    const source = readFileSync(fullPath, 'utf8')
    expect(source).toMatch(/aspect-\[4\/3\]/)
  })
})
