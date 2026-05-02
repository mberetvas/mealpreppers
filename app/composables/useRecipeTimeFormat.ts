import { formatRecipeTime, primaryRecipeMeta } from '~/utils/recipeTimeFormat'

/**
 * Formats time and primary metadata for catalog cards and recipe detail.
 */
export function useRecipeTimeFormat() {
  return {
    formatTime: formatRecipeTime,
    primaryMeta: primaryRecipeMeta,
  }
}
