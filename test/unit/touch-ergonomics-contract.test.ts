import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  MIN_TOUCH_TARGET_CSS_PX,
  TOUCH_ERGONOMICS_COMPLIANCE_SOURCE_FILES,
  TOUCH_ERGONOMICS_CONTRACT_LABEL,
  TOUCH_TARGET_MIN_CLASS,
} from '../../app/constants/touchErgonomics'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

describe(TOUCH_ERGONOMICS_CONTRACT_LABEL, () => {
  it('documents a 44px minimum interactive target (CSS px)', () => {
    expect(MIN_TOUCH_TARGET_CSS_PX).toBe(44)
  })

  it('maps minimum size to Tailwind touch utilities declared in tailwind.config', () => {
    expect(TOUCH_TARGET_MIN_CLASS).toBe('min-h-touch min-w-touch')
    const cfgPath = join(repoRoot, 'tailwind.config.ts')
    const cfg = readFileSync(cfgPath, 'utf8')
    expect(cfg).toMatch(/minHeight:\s*\{[^}]*touch:\s*['"]2\.75rem['"]/s)
    expect(cfg).toMatch(/minWidth:\s*\{[^}]*touch:\s*['"]2\.75rem['"]/s)
    expect(MIN_TOUCH_TARGET_CSS_PX / 16).toBe(2.75)
  })

  it('keeps audited planner/recipe surfaces free of 36px Tailwind size-9 controls', () => {
    const size9 = /\bsize-9\b/
    for (const rel of TOUCH_ERGONOMICS_COMPLIANCE_SOURCE_FILES) {
      const full = join(repoRoot, rel)
      expect(existsSync(full), `missing ${rel}`).toBe(true)
      const text = readFileSync(full, 'utf8')
      expect(size9.test(text), `${rel} must not use size-9 on tap targets`).toBe(false)
    }
  })

  it('anchors high-frequency icon and overflow controls to min-h-touch in source', () => {
    const mealSlot = readFileSync(join(repoRoot, 'app/components/plan/MealSlotCard.vue'), 'utf8')
    const mealIdx = mealSlot.indexOf('aria-label="Meal actions"')
    expect(mealIdx).toBeGreaterThan(-1)
    expect(mealSlot.slice(mealIdx - 160, mealIdx + 40)).toMatch(/min-h-touch/)

    const filterPicker = readFileSync(
      join(repoRoot, 'app/components/recipe/RecipeFilterPicker.vue'),
      'utf8',
    )
    const closeIdx = filterPicker.indexOf(':aria-label="`Close ${label.toLowerCase()} picker`"')
    expect(closeIdx).toBeGreaterThan(-1)
    expect(filterPicker.slice(closeIdx - 400, closeIdx + 60)).toMatch(/min-h-touch/)
  })
})
