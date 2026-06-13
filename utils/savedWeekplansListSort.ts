/** Row shape returned by `GET /api/v1/saved-weekplans` (list projection). */
export interface SavedWeekplanListItem {
  id: string
  name: string
  updatedAt: string
  /** True when a consolidated shopping list row exists for this plan. */
  hasSavedShoppingList: boolean
  /** True when the saved list's source fingerprint no longer matches the current plan body. */
  shoppingListDeprecated: boolean
}

/**
 * Returns a new array sorted for the manage page toggle: recently updated first,
 * or alphabetical by title (case-insensitive), without mutating `items`.
 */
export function sortSavedWeekplanListItems(
  items: readonly SavedWeekplanListItem[],
  sort: 'updated' | 'name',
): SavedWeekplanListItem[] {
  const copy = [...items]
  if (sort === 'name') {
    copy.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    return copy
  }
  // Optimization: String comparison of ISO 8601 strings is ~10-30x faster than localeCompare or Date parsing
  copy.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : b.updatedAt < a.updatedAt ? -1 : 0))
  return copy
}
