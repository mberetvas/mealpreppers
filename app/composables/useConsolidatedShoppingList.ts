import { ref, type Ref } from 'vue'
import type { MergedLine } from '~~/server/services/shopping-list/exactMerge'
import type { PolishResponseChange } from '~~/server/services/shopping-list/polishHarness'
import type { PolishStatus } from '~~/server/services/shopping-list/consolidationService'

export interface ConsolidationResponse {
  consolidatedLines: MergedLine[]
  baselineLines: MergedLine[]
  changes: PolishResponseChange[]
  polishStatus: PolishStatus
  warnings: string[]
}

export interface UseConsolidatedShoppingListOptions {
  fetchConsolidate?: (planId: string) => Promise<ConsolidationResponse>
}

/**
 * Manages consolidated shopping list state: API call, loading, error, retry, and session-scoped caching.
 * Results persist while on the page; cleared on full page reload.
 */
export function useConsolidatedShoppingList(
  planId: Ref<string>,
  options: UseConsolidatedShoppingListOptions = {},
) {
  const {
    fetchConsolidate = (id: string) =>
      $fetch<ConsolidationResponse>(`/api/v1/saved-weekplans/${id}/consolidate-shopping-list`, { method: 'POST' }),
  } = options

  const consolidating = ref(false)
  const consolidatedLines = ref<MergedLine[]>([])
  const baselineLines = ref<MergedLine[]>([])
  const consolidationError = ref<string | null>(null)
  const polishStatus = ref<PolishStatus | null>(null)
  const warnings = ref<string[]>([])
  const hasConsolidated = ref(false)
  const changes = ref<PolishResponseChange[]>([])

  /** Triggers the consolidation API call. Each call refreshes from current plan data. */
  async function consolidate(): Promise<void> {
    if (!planId.value) return

    consolidating.value = true
    consolidationError.value = null

    try {
      const result = await fetchConsolidate(planId.value)
      consolidatedLines.value = result.consolidatedLines
      baselineLines.value = result.baselineLines
      changes.value = result.changes
      polishStatus.value = result.polishStatus
      warnings.value = result.warnings
      hasConsolidated.value = true
    }
    catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Consolidation failed. Please try again.'
      consolidationError.value = message
      hasConsolidated.value = true
    }
    finally {
      consolidating.value = false
    }
  }

  /** Resets all consolidated state (e.g. on page leave or explicit clear). */
  function reset(): void {
    consolidating.value = false
    consolidatedLines.value = []
    baselineLines.value = []
    consolidationError.value = null
    polishStatus.value = null
    warnings.value = []
    hasConsolidated.value = false
    changes.value = []
  }

  return {
    consolidating,
    consolidatedLines,
    baselineLines,
    consolidationError,
    polishStatus,
    warnings,
    hasConsolidated,
    changes,
    consolidate,
    reset,
  }
}
