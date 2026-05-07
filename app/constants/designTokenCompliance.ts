/**
 * Audited UI surfaces for the design token compliance layer (Issue 04).
 * Recipe flows (catalog, detail, edit), catalog cards, filter picker, form
 * status surfaces, and planner cards must not embed raw hex/rgb literals; use
 * Tailwind semantic colors (`primary`, `surface`, …) or `atelier/*` roles backed by CSS variables
 * in `app/assets/css/tailwind.css`.
 */
import { COMPONENT_VOCABULARY_PRIMITIVE_PATHS } from './componentVocabulary'

export const DESIGN_TOKEN_COMPLIANCE_SOURCE_FILES = [
  'app/components/FormFlowStatusSurfaces.vue',
  'app/components/recipe/RecipeCatalogGridCard.vue',
  'app/components/recipe/RecipeFilterPicker.vue',
  'app/components/plan/MealSlotCard.vue',
  'app/pages/add-recipe.vue',
  'app/pages/recipes/index.vue',
  'app/pages/recipes/[id]/index.vue',
  'app/pages/recipes/[id]/edit.vue',
  'app/constants/componentVocabulary.ts',
  ...COMPONENT_VOCABULARY_PRIMITIVE_PATHS,
] as const

export type DesignTokenComplianceSourceFile
  = (typeof DESIGN_TOKEN_COMPLIANCE_SOURCE_FILES)[number]
