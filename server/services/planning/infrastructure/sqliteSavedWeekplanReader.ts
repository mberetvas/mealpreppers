import { eq } from 'drizzle-orm'
import type { AppDb } from '../../../db/sqlite'
import { mealWeekTemplates } from '../../../db/schema/planning'
import type { SavedConsolidatedShoppingListRecord } from '../../shopping-list/consolidatedShoppingListRepository'
import type { PlanningPrincipal } from '../planningPrincipal'
import { fail, ok, type PlanningResult } from '../planningResult'
import { accessInterpretationFailure, savedWeekplanNotFound } from '../savedWeekplanAccessErrors'
import { interpretSavedWeekplanAccess } from '../savedWeekplanAccess'
import type {
  SavedWeekplanAccessRow,
  SavedWeekplanConsolidatedContext,
  SavedWeekplanReader,
} from '../ports/savedWeekplanReader'

function ownerColumns(row: { ownerUserId: string | null, anonSessionId: string | null }) {
  return {
    owner_user_id: row.ownerUserId,
    anon_session_id: row.anonSessionId,
  }
}

function storageError(message: string | undefined, fallback: string) {
  return {
    kind: 'storage_error' as const,
    message: message ?? fallback,
  }
}

function loadRow(db: AppDb, planId: string) {
  return db
    .select({
      id: mealWeekTemplates.id,
      name: mealWeekTemplates.name,
      body: mealWeekTemplates.body,
      createdAt: mealWeekTemplates.createdAt,
      updatedAt: mealWeekTemplates.updatedAt,
      ownerUserId: mealWeekTemplates.ownerUserId,
      anonSessionId: mealWeekTemplates.anonSessionId,
      consolidatedShoppingList: mealWeekTemplates.consolidatedShoppingList,
    })
    .from(mealWeekTemplates)
    .where(eq(mealWeekTemplates.id, planId))
    .get()
}

/** SQLite adapter for [`SavedWeekplanReader`]. */
export class SqliteSavedWeekplanReader implements SavedWeekplanReader {
  async getForConsolidatedListOps(
    db: AppDb,
    planId: string,
    principal: PlanningPrincipal,
  ): Promise<PlanningResult<SavedWeekplanConsolidatedContext>> {
    try {
      const row = loadRow(db, planId)
      if (!row) {
        return fail(savedWeekplanNotFound())
      }

      const accessFailure = accessInterpretationFailure(
        interpretSavedWeekplanAccess(ownerColumns(row), principal),
      )
      if (accessFailure) {
        return fail(accessFailure)
      }

      const record = row.consolidatedShoppingList as SavedConsolidatedShoppingListRecord | null
      return ok({
        body: row.body,
        existingList: record,
      })
    }
    catch (error) {
      return fail(storageError(
        error instanceof Error ? error.message : undefined,
        'Saved weekplan could not be loaded.',
      ))
    }
  }

  async getById(
    db: AppDb,
    planId: string,
    principal: PlanningPrincipal,
  ): Promise<PlanningResult<SavedWeekplanAccessRow>> {
    try {
      const row = loadRow(db, planId)
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
        consolidatedShoppingList: row.consolidatedShoppingList as SavedConsolidatedShoppingListRecord | null,
      })
    }
    catch (error) {
      return fail(storageError(
        error instanceof Error ? error.message : undefined,
        'Saved weekplan could not be loaded.',
      ))
    }
  }
}

export const sqliteSavedWeekplanReader = new SqliteSavedWeekplanReader()
