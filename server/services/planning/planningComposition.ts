import type { AppDb } from '../../db/sqlite'
import { sqliteConsolidatedShoppingListCopyAdapter } from '../shopping-list/infrastructure/sqliteConsolidatedShoppingListCopyAdapter'
import type { CreateSavedWeekplanDeps } from './application/createSavedWeekplan'
import { sqliteSavedWeekplanReader } from './infrastructure/sqliteSavedWeekplanReader'
import type { SavedWeekplanReader } from './ports/savedWeekplanReader'

export interface PlanningDeps {
  savedWeekplanReader: SavedWeekplanReader
  createSavedWeekplanDeps: CreateSavedWeekplanDeps
}

/** Default Planning slice adapters for Nitro handlers. */
export function createPlanningDeps(db: AppDb): PlanningDeps {
  return {
    savedWeekplanReader: sqliteSavedWeekplanReader,
    createSavedWeekplanDeps: {
      db,
      copyPort: sqliteConsolidatedShoppingListCopyAdapter,
    },
  }
}
