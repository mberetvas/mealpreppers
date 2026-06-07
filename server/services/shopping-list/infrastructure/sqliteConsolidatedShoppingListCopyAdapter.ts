import { and, eq, isNotNull, ne } from 'drizzle-orm'
import type { AppDb } from '../../../db/sqlite'
import { mealWeekTemplates } from '../../../db/schema/planning'
import type { ConsolidatedShoppingListCopyPort } from '../../planning/ports/consolidatedShoppingListCopyPort'
import type { PlanningPrincipal } from '../../planning/planningPrincipal'
import { fail, ok, type PlanningResult } from '../../planning/planningResult'
import type { CopyOnMatchResult, SavedConsolidatedShoppingListRecord } from '../consolidatedShoppingListRepository'
import { computeSourceFingerprint } from '../sourceFingerprint'

function storageError(message: string | undefined, fallback: string) {
  return {
    kind: 'storage_error' as const,
    message: message ?? fallback,
  }
}

function principalFilter(principal: PlanningPrincipal) {
  return eq(mealWeekTemplates.ownerUserId, principal.userId)
}

/**
 * Shopping list infrastructure adapter for [`ConsolidatedShoppingListCopyPort`].
 * Must run inside a transaction when atomic create+copy is required.
 */
export class SqliteConsolidatedShoppingListCopyAdapter implements ConsolidatedShoppingListCopyPort {
  copyFromMatchingPlan(
    db: AppDb,
    newPlanId: string,
    principal: PlanningPrincipal,
    fingerprint: string,
  ): PlanningResult<CopyOnMatchResult> {
    try {
      const rows = db
        .select({
          id: mealWeekTemplates.id,
          body: mealWeekTemplates.body,
          consolidatedShoppingList: mealWeekTemplates.consolidatedShoppingList,
        })
        .from(mealWeekTemplates)
        .where(and(
          principalFilter(principal),
          isNotNull(mealWeekTemplates.consolidatedShoppingList),
          ne(mealWeekTemplates.id, newPlanId),
        ))
        .all()

      const validMatches = rows.filter((row) => {
        const list = row.consolidatedShoppingList as SavedConsolidatedShoppingListRecord | null
        if (!list) return false
        if (list.sourceFingerprint !== fingerprint) return false
        return computeSourceFingerprint(row.body) === fingerprint
      })

      if (validMatches.length === 0) {
        return ok({ copied: false })
      }

      validMatches.sort((a, b) =>
        (b.consolidatedShoppingList as SavedConsolidatedShoppingListRecord).confirmedAt
          .localeCompare((a.consolidatedShoppingList as SavedConsolidatedShoppingListRecord).confirmedAt),
      )

      const listToCopy = validMatches[0]!.consolidatedShoppingList as SavedConsolidatedShoppingListRecord

      db.update(mealWeekTemplates)
        .set({ consolidatedShoppingList: listToCopy })
        .where(eq(mealWeekTemplates.id, newPlanId))
        .run()

      return ok({ copied: true, copiedList: listToCopy })
    }
    catch (error) {
      return fail(storageError(
        error instanceof Error ? error.message : undefined,
        'Could not look up matching plans for copy-on-match.',
      ))
    }
  }
}

export const sqliteConsolidatedShoppingListCopyAdapter = new SqliteConsolidatedShoppingListCopyAdapter()
