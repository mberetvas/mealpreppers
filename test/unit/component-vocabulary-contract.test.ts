import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  COMPONENT_VOCABULARY_PRIMITIVE_PATHS,
  FILTER_CHIP_BUTTON_BASE_CLASS,
} from '../../app/constants/componentVocabulary'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

const RAW_HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/

describe('component vocabulary consolidation (Issue 08)', () => {
  it('filter chip base class encodes touch and focus token contracts', () => {
    expect(FILTER_CHIP_BUTTON_BASE_CLASS).toContain('min-h-touch')
    expect(FILTER_CHIP_BUTTON_BASE_CLASS).toContain('rounded-full')
    expect(FILTER_CHIP_BUTTON_BASE_CLASS).toContain('focus-visible:outline-primary')
  })

  it('BlockButton encodes both primary and CTA semantic surfaces', () => {
    const src = readFileSync(join(repoRoot, 'app/components/atelier/BlockButton.vue'), 'utf8')
    expect(src).toContain('bg-primary')
    expect(src).toContain('bg-atelier-cta')
  })

  it('CircleIconButton covers accent, ghost, and danger treatment tokens', () => {
    const src = readFileSync(join(repoRoot, 'app/components/atelier/CircleIconButton.vue'), 'utf8')
    expect(src).toContain('bg-atelier-chip')
    expect(src).toContain('hover:bg-atelier-chip')
    expect(src).toContain('text-atelier-destructive')
  })

  it('RecipePill defines meta and category chip token variants', () => {
    const src = readFileSync(join(repoRoot, 'app/components/atelier/RecipePill.vue'), 'utf8')
    expect(src).toContain('bg-atelier-chip')
    expect(src).toContain('bg-atelier-parchment/95')
    expect(src).toContain("props.variant === 'category'")
  })

  for (const relative of COMPONENT_VOCABULARY_PRIMITIVE_PATHS) {
    it(`${relative} has no raw hex color literals`, () => {
      const fullPath = join(repoRoot, relative)
      const source = readFileSync(fullPath, 'utf8')
      expect(source.match(RAW_HEX_COLOR), `${relative} contains hex literal`).toBeNull()
    })
  }

  it('componentVocabulary.ts has no raw hex color literals', () => {
    const fullPath = join(repoRoot, 'app/constants/componentVocabulary.ts')
    const source = readFileSync(fullPath, 'utf8')
    expect(source.match(RAW_HEX_COLOR)).toBeNull()
  })
})
