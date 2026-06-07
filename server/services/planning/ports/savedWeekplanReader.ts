import type { WeekPlanV1 } from '../../../../types/planning'
import type { AppDb } from '../../../db/sqlite'
import type { SavedConsolidatedShoppingListRecord } from '../../shopping-list/consolidatedShoppingListRepository'
import type { PlanningPrincipal } from '../planningPrincipal'
import type { PlanningResult } from '../planningResult'

/** Weekplan context required for consolidated shopping list reads and writes. */
export interface SavedWeekplanConsolidatedContext {
  body: WeekPlanV1
  existingList: SavedConsolidatedShoppingListRecord | null
}

/** Principal-scoped weekplan row used by Planning CRUD and read-model assembly. */
export interface SavedWeekplanAccessRow {
  id: string
  name: string
  body: WeekPlanV1
  createdAt: string
  updatedAt: string
  consolidatedShoppingList: SavedConsolidatedShoppingListRecord | null
}

/** Planning read port for Saved Weekplan ownership and body (consumer: Planning + Shopping list). */
export interface SavedWeekplanReader {
  getForConsolidatedListOps(
    db: AppDb,
    planId: string,
    principal: PlanningPrincipal,
  ): Promise<PlanningResult<SavedWeekplanConsolidatedContext>>

  getById(
    db: AppDb,
    planId: string,
    principal: PlanningPrincipal,
  ): Promise<PlanningResult<SavedWeekplanAccessRow>>
}
