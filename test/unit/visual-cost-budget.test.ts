import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  AD_HOC_MODAL_RGBA_SHADOW_PATTERN,
  LEGACY_HEAVY_GRID_SHADOW_PATTERN,
  VISUAL_COST_BUDGET_MODAL_SURFACE_FILES,
  VISUAL_COST_BUDGET_SCROLL_SURFACE_FILES,
} from '../../app/constants/visualCostBudget'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

describe('visual cost budget (scroll-heavy grids)', () => {
  for (const relative of VISUAL_COST_BUDGET_SCROLL_SURFACE_FILES) {
    it(`${relative} avoids legacy heavy arbitrary grid shadows`, () => {
      const fullPath = join(repoRoot, relative)
      const source = readFileSync(fullPath, 'utf8')
      const match = source.match(LEGACY_HEAVY_GRID_SHADOW_PATTERN)
      expect(match, `${relative} still uses heavy grid shadow: ${match?.[0] ?? ''}`).toBeNull()
    })
  }
})

describe('visual cost budget (modal surfaces)', () => {
  for (const relative of VISUAL_COST_BUDGET_MODAL_SURFACE_FILES) {
    it(`${relative} avoids ad-hoc primary-tinted rgba box shadows on panels`, () => {
      const fullPath = join(repoRoot, relative)
      const source = readFileSync(fullPath, 'utf8')
      const match = source.match(AD_HOC_MODAL_RGBA_SHADOW_PATTERN)
      expect(match, `${relative} uses inline rgba panel shadow: ${match?.[0] ?? ''}`).toBeNull()
    })
  }
})
