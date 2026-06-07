import type { WeekTemplateCreateInput } from '../../../../types/planning'
import type { AppDb } from '../../../db/sqlite'
import type { ConsolidatedShoppingListCopyPort } from '../ports/consolidatedShoppingListCopyPort'
import type { PlanningPrincipal } from '../planningPrincipal'
import { fail, ok, type PlanningFailure, type PlanningResult } from '../planningResult'
import type { WeekTemplateRow } from '../planningRepository'
import { insertSavedWeekplanRow } from '../savedWeekplansRepository'
import { computeSourceFingerprint } from '../../shopping-list/sourceFingerprint'

export interface CreateSavedWeekplanResult extends WeekTemplateRow {
  shoppingListCopiedFromMatch: boolean
}

export interface CreateSavedWeekplanDeps {
  db: AppDb
  copyPort: ConsolidatedShoppingListCopyPort
}

class PlanningTransactionAbort extends Error {
  constructor(readonly result: PlanningResult<never>) {
    super('planning transaction aborted')
  }
}

function storageError(message: string | undefined, fallback: string): PlanningFailure {
  return {
    kind: 'storage_error',
    message: message ?? fallback,
  }
}

/**
 * Creates a Saved Weekplan and copies a matching consolidated list when found.
 * Copy-on-match storage failures are non-fatal: the plan is still created and
 * `shoppingListCopiedFromMatch` is false (same contract as the legacy handler).
 */
export function executeCreateSavedWeekplan(
  deps: CreateSavedWeekplanDeps,
  principal: PlanningPrincipal,
  input: WeekTemplateCreateInput,
): PlanningResult<CreateSavedWeekplanResult> {
  const fingerprint = computeSourceFingerprint(input.body)

  try {
    return deps.db.transaction((tx) => {
      const createResult = insertSavedWeekplanRow(tx, principal, input)
      if (!createResult.ok) {
        throw new PlanningTransactionAbort(createResult)
      }

      const copyResult = deps.copyPort.copyFromMatchingPlan(
        tx,
        createResult.value.id,
        principal,
        fingerprint,
      )
      const shoppingListCopiedFromMatch = copyResult.ok && copyResult.value.copied

      return ok({
        ...createResult.value,
        shoppingListCopiedFromMatch,
      })
    })
  }
  catch (error) {
    if (error instanceof PlanningTransactionAbort) {
      return error.result
    }
    return fail(storageError(
      error instanceof Error ? error.message : undefined,
      'Saved weekplan could not be created.',
    ))
  }
}
