import type { PolishContext } from './exactMerge'
import type { PolishResponse } from './polishHarness'

/** Result returned by a shopping list polish port implementation. */
export interface PolishPortResult {
  response: PolishResponse
}

/**
 * Injectable interface for the Shopping list polish port.
 * Implementations transform raw merged lines via AI or return them unchanged.
 */
export interface ShoppingListPolishPort {
  polish(context: PolishContext): Promise<PolishPortResult>
}
