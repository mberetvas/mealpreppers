import { ref, watch, type Ref } from 'vue'
import type { MergedLine } from '~~/server/services/shopping-list/exactMerge'
import { sortShoppingListLines } from '~~/server/services/shopping-list/aisleSort'
import type { PolishResponseChange } from '~~/server/services/shopping-list/polishHarness'
import type { PolishStatus } from '~~/server/services/shopping-list/consolidationService'
import type { PolishHint } from '~~/server/services/shopping-list/polishHintBuilder'
import type { SavedConsolidatedShoppingListRecord, SavedShoppingListLine, ShoppingListFlags } from '~~/server/services/shopping-list/consolidatedShoppingListRepository'
import type { WeekTemplateRowWithShoppingListFlags } from '~~/server/services/planning/savedWeekplansRepository'

export interface ConsolidationResponse {
  consolidatedLines: MergedLine[]
  baselineLines: MergedLine[]
  changes: PolishResponseChange[]
  polishStatus: PolishStatus
  warnings: string[]
  hints?: PolishHint[]
}

export interface UseConsolidatedShoppingListOptions {
  fetchConsolidate?: (planId: string) => Promise<ConsolidationResponse>
  fetchSavedList?: (planId: string) => Promise<SavedConsolidatedShoppingListRecord | null>
  savelist?: (planId: string, lines: SavedShoppingListLine[]) => Promise<SavedConsolidatedShoppingListRecord>
  fetchPlanFlags?: (planId: string) => Promise<ShoppingListFlags>
}

/**
 * Manages consolidated shopping list state: API call, loading, error, retry, persistence,
 * and session-scoped caching. Confirmed results are persisted via PUT and loaded on revisit.
 */
export function useConsolidatedShoppingList(
  planId: Ref<string>,
  options: UseConsolidatedShoppingListOptions = {},
) {
  const {
    fetchConsolidate = (id: string) =>
      $fetch<ConsolidationResponse>(`/api/v1/saved-weekplans/${id}/consolidate-shopping-list`, { method: 'POST' }),
    fetchSavedList = (id: string) =>
      $fetch<SavedConsolidatedShoppingListRecord>(`/api/v1/saved-weekplans/${id}/consolidated-shopping-list`, { method: 'GET' }).catch(() => null),
    savelist = (id: string, lines: SavedShoppingListLine[]) =>
      $fetch<SavedConsolidatedShoppingListRecord>(`/api/v1/saved-weekplans/${id}/consolidated-shopping-list`, { method: 'PUT', body: { lines } }),
    fetchPlanFlags = (id: string) =>
      $fetch<WeekTemplateRowWithShoppingListFlags>(`/api/v1/saved-weekplans/${id}`, { method: 'GET' }).then(r => ({
        hasSavedShoppingList: r.hasSavedShoppingList,
        shoppingListDeprecated: r.shoppingListDeprecated,
      })),
  } = options

  const consolidating = ref(false)
  const consolidatedLines = ref<MergedLine[]>([])
  const baselineLines = ref<MergedLine[]>([])
  const consolidationError = ref<string | null>(null)
  const polishStatus = ref<PolishStatus | null>(null)
  const warnings = ref<string[]>([])
  const hasConsolidated = ref(false)
  const changes = ref<PolishResponseChange[]>([])
  const hints = ref<PolishHint[]>([])
  const reviewLines = ref<MergedLine[]>([])
  const savedList = ref<SavedConsolidatedShoppingListRecord | null>(null)
  const saving = ref(false)
  const saveError = ref<string | null>(null)
  const shoppingListDeprecated = ref(false)
  /** True after loadSavedList finishes for the current plan (flags known before polished state is set). */
  const savedListHydrationSettled = ref(false)

  let consolidateGeneration = 0

  // Reset state whenever the active plan changes, then hydrate any saved consolidated list
  watch(planId, () => {
    reset()
    void loadSavedList()
  }, { immediate: true })

  /** Loads the saved consolidated shopping list from the server. Checks deprecation status via plan flags. */
  async function loadSavedList(): Promise<void> {
    if (!planId.value) return

    const planAtStart = planId.value
    savedListHydrationSettled.value = false

    try {
      const result = await fetchSavedList(planAtStart)
      if (planId.value !== planAtStart) return
      if (result) {
        let deprecated = false
        try {
          const flags = await fetchPlanFlags(planAtStart)
          if (planId.value !== planAtStart) return
          deprecated = flags.shoppingListDeprecated
        }
        catch {
          if (planId.value !== planAtStart) return
          deprecated = false
        }

        shoppingListDeprecated.value = deprecated
        savedList.value = result
        const lines = sortShoppingListLines(result.lines.map(l => ({
          ...l,
          quantity: l.quantity,
          unit: l.unit,
          provenance: [] as { recipeId: string, recipeTitle: string }[],
        })))
        consolidatedLines.value = lines
        baselineLines.value = lines.map(l => ({ ...l }))
        changes.value = []
        polishStatus.value = 'polished'
        hasConsolidated.value = true
      }
    }
    catch {
      if (planId.value !== planAtStart) return
      // No saved list — user must consolidate
    }
    finally {
      if (planId.value === planAtStart) {
        savedListHydrationSettled.value = true
      }
    }
  }

  /** Triggers the consolidation API call. Each call refreshes from current plan data and clears deprecated state. */
  async function consolidate(): Promise<void> {
    if (!planId.value) return

    const generation = ++consolidateGeneration
    consolidating.value = true
    consolidationError.value = null
    shoppingListDeprecated.value = false

    try {
      const result = await fetchConsolidate(planId.value)
      if (generation !== consolidateGeneration) return
      consolidatedLines.value = result.consolidatedLines
      baselineLines.value = result.baselineLines
      changes.value = result.changes
      polishStatus.value = result.polishStatus
      warnings.value = result.warnings
      hints.value = result.hints ?? []
      reviewLines.value = result.polishStatus === 'pending_review'
        ? sortShoppingListLines(result.consolidatedLines.map(line => ({ ...line })))
        : []
      if (result.polishStatus === 'pending_review') {
        consolidatedLines.value = []
      }
      hasConsolidated.value = true
    }
    catch (error: unknown) {
      if (generation !== consolidateGeneration) return
      const message = error instanceof Error ? error.message : 'Consolidation failed. Please try again.'
      consolidationError.value = message
      hasConsolidated.value = true
    }
    finally {
      if (generation === consolidateGeneration) {
        consolidating.value = false
      }
    }
  }

  /** Updates a single review line field. Only allows editing existing line IDs. */
  function updateReviewLine(lineId: string, fields: Partial<Pick<MergedLine, 'name' | 'quantity' | 'unit'>>): void {
    const idx = reviewLines.value.findIndex(l => l.id === lineId)
    if (idx === -1) return
    reviewLines.value[idx] = { ...reviewLines.value[idx], ...fields }
  }

  /** Confirms review edits: applies reviewLines to consolidatedLines, persists via PUT, and marks as polished. Blocked when deprecated. */
  async function confirmReview(): Promise<void> {
    if (polishStatus.value !== 'pending_review') return
    if (shoppingListDeprecated.value) return

    const confirmedLines = sortShoppingListLines(reviewLines.value.map(l => ({ ...l })))
    const linesToSave: SavedShoppingListLine[] = confirmedLines.map(l => ({
      id: l.id,
      name: l.name,
      quantity: l.quantity,
      unit: l.unit,
    }))

    saving.value = true
    saveError.value = null
    try {
      const result = await savelist(planId.value, linesToSave)
      consolidatedLines.value = confirmedLines
      polishStatus.value = 'polished'
      hints.value = []
      reviewLines.value = []
      savedList.value = result
      shoppingListDeprecated.value = false
    }
    catch (error: unknown) {
      saveError.value = error instanceof Error ? error.message : 'Could not save the shopping list.'
    }
    finally {
      saving.value = false
    }
  }

  /** Enters edit mode for a saved shopping list: pre-fills reviewLines from savedList without calling consolidation. Skips hints (edit-only path). */
  function editSaved(): void {
    if (!savedList.value) return
    if (shoppingListDeprecated.value) return

    const lines = sortShoppingListLines(savedList.value.lines.map(l => ({
      ...l,
      quantity: l.quantity,
      unit: l.unit,
      provenance: [] as { recipeId: string, recipeTitle: string }[],
    })))

    reviewLines.value = lines.map(l => ({ ...l }))
    baselineLines.value = lines.map(l => ({ ...l }))
    hints.value = []
    polishStatus.value = 'pending_review'
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
    hints.value = []
    reviewLines.value = []
    savedList.value = null
    saving.value = false
    saveError.value = null
    shoppingListDeprecated.value = false
    savedListHydrationSettled.value = false
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
    hints,
    reviewLines,
    savedList,
    saving,
    saveError,
    shoppingListDeprecated,
    savedListHydrationSettled,
    consolidate,
    loadSavedList,
    editSaved,
    updateReviewLine,
    confirmReview,
    reset,
  }
}
