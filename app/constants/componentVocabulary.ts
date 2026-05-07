/**
 * Consolidated UI primitives for recipe and planning surfaces (Issue 08).
 * Used by contract tests to ensure tokenized chip controls stay centralized.
 */

/** Vue primitives that own card / chip / control vocabulary for audited flows. */
export const COMPONENT_VOCABULARY_PRIMITIVE_PATHS = [
  'app/components/atelier/BlockButton.vue',
  'app/components/atelier/CircleIconButton.vue',
  'app/components/atelier/DenseFormRow.vue',
  'app/components/atelier/InsetWell.vue',
  'app/components/atelier/InversePanel.vue',
  'app/components/atelier/ParchmentSection.vue',
  'app/components/atelier/PillChipButton.vue',
  'app/components/atelier/RecipePill.vue',
  'app/components/atelier/SegmentButton.vue',
  'app/components/atelier/SegmentRail.vue',
  'app/components/atelier/StepIndexBadge.vue',
] as const

export type ComponentVocabularyPrimitivePath
  = (typeof COMPONENT_VOCABULARY_PRIMITIVE_PATHS)[number]

/**
 * Shared base for selectable filter chips (RecipeFilterPicker).
 * Must stay aligned with touch and focus contracts in touchErgonomics.
 */
export const FILTER_CHIP_BUTTON_BASE_CLASS
  = 'inline-flex min-h-touch shrink-0 items-center justify-center rounded-full px-3.5 text-xs font-bold transition-colors duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none' as const
