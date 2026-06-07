import type { WeekPlanV1 } from '../../../types/planning'
import type { SavedConsolidatedShoppingListRecord } from '../shopping-list/consolidatedShoppingListRepository'
import { computeSourceFingerprint } from '../shopping-list/sourceFingerprint'

export interface ShoppingListFlags {
  hasSavedShoppingList: boolean
  shoppingListDeprecated: boolean
}

/** Read-model flags derived from stored list JSON and current plan body. */
export function computeShoppingListFlags(
  record: SavedConsolidatedShoppingListRecord | null,
  body: WeekPlanV1,
): ShoppingListFlags {
  if (!record) {
    return { hasSavedShoppingList: false, shoppingListDeprecated: false }
  }

  const currentFingerprint = computeSourceFingerprint(body)
  const deprecated = record.sourceFingerprint !== currentFingerprint

  return { hasSavedShoppingList: true, shoppingListDeprecated: deprecated }
}
