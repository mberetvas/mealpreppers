import type { ConsolidationContext } from './exactMerge'
import type { PolishResponse } from './polishHarness'

/** Result returned by a shopping list polish port implementation. */
export interface PolishPortResult {
  response: PolishResponse
}

/**
 * Injectable interface for the Shopping list polish port.
 * Implementations consolidate recipe-grouped ingredients via AI.
 */
export interface ShoppingListPolishPort {
  polish(context: ConsolidationContext): Promise<PolishPortResult>
}
