/**
 * Visual cost budget (Issue 06): scroll-heavy recipe/planner surfaces avoid
 * large per-cell blur stacks; use tiered `shadow-atelier-grid-*` utilities in
 * `app/assets/css/tailwind.css` plus rings / tonal separation.
 */
export const VISUAL_COST_BUDGET_SCROLL_SURFACE_FILES = [
  'app/pages/recipes/index.vue',
  'app/components/recipe/RecipeCatalogGridCard.vue',
] as const

/** Planner modals should use semantic panel elevation, not ad-hoc rgba shadows. */
export const VISUAL_COST_BUDGET_MODAL_SURFACE_FILES = [
  'app/components/plan/RecipePickerModal.vue',
  'app/pages/weekly-plan.vue',
] as const

/** Legacy catalog grid wrappers used heavy arbitrary shadows (large blur radius per card). */
export const LEGACY_HEAVY_GRID_SHADOW_PATTERN = /shadow-\[0_(?:18px|26px)_/

/** Inline modal shadows bypass token tiering; prefer `shadow-atelier-panel`. */
export const AD_HOC_MODAL_RGBA_SHADOW_PATTERN = /shadow-\[[^\]]*rgba\s*\(\s*15\s*,\s*82\s*,\s*56/
