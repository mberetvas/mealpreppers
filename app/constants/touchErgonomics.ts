/**
 * Touch ergonomics rule set (Issue 05): minimum hit geometry for icon-only
 * buttons, dense chips, and destructive actions on recipe/planner surfaces.
 *
 * **Minimum target:** 44×44 CSS pixels. This matches common platform HIG
 * guidance (e.g. Apple 44pt) and WCAG 2.2 Success Criterion 2.5.5 Target Size
 * (Enhanced) at AAA; we adopt it as the product default for kitchen / mobile
 * comfort rather than the smaller 24px minimum in SC 2.5.8 alone.
 *
 * Apply `TOUCH_TARGET_MIN_CLASS` (or equivalent `min-h-11`/`size-11` = 2.75rem)
 * to the interactive element that receives the click, not merely the glyph.
 */
export const MIN_TOUCH_TARGET_CSS_PX = 44 as const

/** Tailwind utilities from `theme.extend.minHeight` / `minWidth` (`touch`). */
export const TOUCH_TARGET_MIN_CLASS = 'min-h-touch min-w-touch' as const

/** Stable label for Vitest suites documenting this contract. */
export const TOUCH_ERGONOMICS_CONTRACT_LABEL = 'Touch ergonomics rule set' as const

/** Files audited for minimum touch targets alongside Issue 05 acceptance. */
export const TOUCH_ERGONOMICS_COMPLIANCE_SOURCE_FILES = [
  'app/components/layout/MobileBottomNav.vue',
  'app/components/plan/MealSlotCard.vue',
  'app/components/plan/MonthPlanOverview.vue',
  'app/components/plan/RecipePickerModal.vue',
  'app/components/recipe/RecipeFilterPicker.vue',
  'app/pages/add-recipe.vue',
  'app/pages/recipes/[id]/edit.vue',
] as const

export type TouchErgonomicsComplianceSourceFile
  = (typeof TOUCH_ERGONOMICS_COMPLIANCE_SOURCE_FILES)[number]
