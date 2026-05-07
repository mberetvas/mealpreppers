/**
 * Image loading strategy (Issue 07, PRD user stories 8, 22).
 *
 * Scroll-heavy recipe and planner surfaces should bind non-hero thumbnails with
 * {@link LIST_RECIPE_NON_CRITICAL_IMAGE_ATTRS}: viewport-deferred load (`loading="lazy"`),
 * non-blocking decode (`decoding="async"`), and deprioritized network (`fetchpriority="low"`).
 *
 * Layout: keep a fixed aspect frame (`aspect-*`) or explicit width/height on the image
 * container so cards do not jump when the file arrives.
 *
 * Alt: use {@link recipeIdentityListImageAlt} when the image is the primary visual identity
 * (e.g. catalog grid). Use `alt=""` (optionally `aria-hidden="true"`) when the recipe name
 * is already visible as text beside the thumb (decorative redundancy).
 *
 * @see Docs/issues/ui-quality-remediation-v1/issue-07-image-loading-strategy-module.md
 */

export const LIST_IMAGE_LOADING_STRATEGY_LABEL = 'image loading strategy module (Issue 07)'

/** Vue/scroll list surfaces that must apply list image defaults (enforced in unit tests). */
export const LIST_IMAGE_STRATEGY_SURFACE_FILES = [
  'app/components/recipe/RecipeCatalogGridCard.vue',
  'app/components/plan/MealSlotCard.vue',
  'app/components/plan/RecipePickerModal.vue',
  'app/components/plan/MonthPlanOverview.vue',
] as const

/** Bind to `<img>` for non-critical list thumbnails (catalog rows, planner cards, month chips). */
export const LIST_RECIPE_NON_CRITICAL_IMAGE_ATTRS = {
  loading: 'lazy' as const,
  decoding: 'async' as const,
  fetchpriority: 'low' as const,
}

/** Alt text when list imagery communicates recipe identity (PRD). */
export function recipeIdentityListImageAlt(recipeTitle: string): string {
  return `Photo of ${recipeTitle}`
}
