import type { AppDb } from '../../../db/sqlite'
import type { CopyOnMatchResult } from '../../shopping-list/consolidatedShoppingListRepository'
import type { PlanningPrincipal } from '../planningPrincipal'
import type { PlanningResult } from '../planningResult'

/**
 * Planning consumer port: copy a confirmed consolidated list from a matching plan
 * after Saved Weekplan create. Implemented in the Shopping list slice.
 */
export interface ConsolidatedShoppingListCopyPort {
  copyFromMatchingPlan(
    db: AppDb,
    newPlanId: string,
    principal: PlanningPrincipal,
    fingerprint: string,
  ): PlanningResult<CopyOnMatchResult>
}
