import type { WeekPlanV1 } from '../../../../types/planning'
import type { AppDb } from '../../../db/sqlite'
import type { SavedConsolidatedShoppingListRecord } from '../../shopping-list/consolidatedShoppingListRepository'
import type { PlanningPrincipal } from '../planningPrincipal'
import { fail, ok, type PlanningResult } from '../planningResult'
import { accessInterpretationFailure, savedWeekplanNotFound } from '../savedWeekplanAccessErrors'
import { interpretSavedWeekplanAccess } from '../savedWeekplanAccess'
import type {
  SavedWeekplanAccessRow,
  SavedWeekplanConsolidatedContext,
  SavedWeekplanListRow,
  SavedWeekplanReader,
} from '../ports/savedWeekplanReader'

/** Stored row shape for the in-memory [`SavedWeekplanReader`] fake. */
export interface InMemorySavedWeekplanRow {
  id: string
  name: string
  body: WeekPlanV1
  createdAt: string
  updatedAt: string
  ownerUserId: string | null
  anonSessionId: string | null
  consolidatedShoppingList: SavedConsolidatedShoppingListRecord | null
}

function ownerColumns(row: InMemorySavedWeekplanRow) {
  return {
    owner_user_id: row.ownerUserId,
    anon_session_id: row.anonSessionId,
  }
}

/** In-memory adapter for [`SavedWeekplanReader`] (tests and seam verification). */
export class InMemorySavedWeekplanReader implements SavedWeekplanReader {
  constructor(private readonly rows: InMemorySavedWeekplanRow[] = []) {}

  async listForPrincipal(
    _db: AppDb,
    principal: PlanningPrincipal,
  ): Promise<PlanningResult<SavedWeekplanListRow[]>> {
    const matched = this.rows
      .filter(row => interpretSavedWeekplanAccess(ownerColumns(row), principal) === 'matched')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    return ok(matched.map(row => ({
      id: row.id,
      name: row.name,
      updatedAt: row.updatedAt,
      body: row.body,
      consolidatedShoppingList: row.consolidatedShoppingList,
    })))
  }

  async getForConsolidatedListOps(
    _db: AppDb,
    planId: string,
    principal: PlanningPrincipal,
  ): Promise<PlanningResult<SavedWeekplanConsolidatedContext>> {
    const row = this.rows.find(candidate => candidate.id === planId)
    if (!row) {
      return fail(savedWeekplanNotFound())
    }

    const accessFailure = accessInterpretationFailure(
      interpretSavedWeekplanAccess(ownerColumns(row), principal),
    )
    if (accessFailure) {
      return fail(accessFailure)
    }

    return ok({
      body: row.body,
      existingList: row.consolidatedShoppingList,
    })
  }

  async getById(
    _db: AppDb,
    planId: string,
    principal: PlanningPrincipal,
  ): Promise<PlanningResult<SavedWeekplanAccessRow>> {
    const row = this.rows.find(candidate => candidate.id === planId)
    if (!row) {
      return fail(savedWeekplanNotFound())
    }

    const accessFailure = accessInterpretationFailure(
      interpretSavedWeekplanAccess(ownerColumns(row), principal),
    )
    if (accessFailure) {
      return fail(accessFailure)
    }

    return ok({
      id: row.id,
      name: row.name,
      body: row.body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      consolidatedShoppingList: row.consolidatedShoppingList,
    })
  }
}
