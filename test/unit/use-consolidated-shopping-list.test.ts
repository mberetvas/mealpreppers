import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick, effectScope } from 'vue'
import { useConsolidatedShoppingList, type ConsolidationResponse } from '../../app/composables/useConsolidatedShoppingList'

function makePendingReviewResponse(): ConsolidationResponse {
  const lines = [
    { id: 'recipe-1:0', name: 'pasta', quantity: 800, unit: 'g', provenance: [{ recipeId: 'r1', recipeTitle: 'Pasta' }] },
    { id: 'recipe-1:1', name: 'olijfolie', quantity: 4, unit: 'el', provenance: [{ recipeId: 'r1', recipeTitle: 'Pasta' }] },
  ]
  return {
    consolidatedLines: lines,
    baselineLines: lines.map(l => ({ ...l, id: l.id })),
    changes: [],
    polishStatus: 'pending_review',
    warnings: [],
  }
}

function makeFallbackResponse(): ConsolidationResponse {
  return {
    consolidatedLines: [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ],
    baselineLines: [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ],
    changes: [],
    polishStatus: 'baseline_fallback',
    warnings: ['AI polish output rejected by harness validation; returning baseline.'],
  }
}

function makeAiSkippedResponse(): ConsolidationResponse {
  return {
    consolidatedLines: [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ],
    baselineLines: [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ],
    changes: [],
    polishStatus: 'ai_skipped',
    warnings: ['AI polish was skipped because the API key is not configured.'],
  }
}

describe('useConsolidatedShoppingList', () => {
  it('starts with empty state', () => {
    const planId = ref('plan-1')
    const { consolidating, consolidatedLines, hasConsolidated, consolidationError } =
      useConsolidatedShoppingList(planId, { fetchConsolidate: vi.fn() })

    expect(consolidating.value).toBe(false)
    expect(consolidatedLines.value).toEqual([])
    expect(hasConsolidated.value).toBe(false)
    expect(consolidationError.value).toBeNull()
  })

  it('sets consolidating to true during API call', async () => {
    const planId = ref('plan-1')
    let resolvePromise: (v: ConsolidationResponse) => void
    const fetchConsolidate = vi.fn(() => new Promise<ConsolidationResponse>((res) => { resolvePromise = res }))

    const { consolidating, consolidate } = useConsolidatedShoppingList(planId, { fetchConsolidate })

    const promise = consolidate()
    expect(consolidating.value).toBe(true)

    resolvePromise!(makePendingReviewResponse())
    await promise
    expect(consolidating.value).toBe(false)
  })

  it('enters review mode on AI success without showing consolidated lines yet', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makePendingReviewResponse())

    const { consolidatedLines, reviewLines, polishStatus, hasConsolidated, consolidate } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    expect(consolidatedLines.value).toEqual([])
    expect(reviewLines.value).toHaveLength(2)
    expect(polishStatus.value).toBe('pending_review')
    expect(hasConsolidated.value).toBe(true)
  })

  it('stores baseline lines and warnings on baseline_fallback', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makeFallbackResponse())

    const { baselineLines, polishStatus, warnings, consolidate } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    expect(polishStatus.value).toBe('baseline_fallback')
    expect(baselineLines.value).toHaveLength(1)
    expect(warnings.value[0]).toContain('harness validation')
  })

  it('stores ai_skipped status and baseline lines', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makeAiSkippedResponse())

    const { polishStatus, warnings, consolidate } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    expect(polishStatus.value).toBe('ai_skipped')
    expect(warnings.value[0]).toContain('API key')
  })

  it('sets consolidationError on fetch failure', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockRejectedValue(new Error('Network error'))

    const { consolidationError, hasConsolidated, consolidate } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    expect(consolidationError.value).toBe('Network error')
    expect(hasConsolidated.value).toBe(true)
  })

  it('does not call API when planId is empty', async () => {
    const planId = ref('')
    const fetchConsolidate = vi.fn()

    const { consolidate } = useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    expect(fetchConsolidate).not.toHaveBeenCalled()
  })

  it('each consolidate call refreshes from current data', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makePendingReviewResponse())

    const { consolidate } = useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    await consolidate()
    expect(fetchConsolidate).toHaveBeenCalledTimes(2)
  })

  it('reset clears all state', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makePendingReviewResponse())

    const { reviewLines, consolidatedLines, hasConsolidated, consolidate, reset } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    expect(hasConsolidated.value).toBe(true)
    expect(reviewLines.value).toHaveLength(2)

    reset()
    expect(hasConsolidated.value).toBe(false)
    expect(reviewLines.value).toEqual([])
    expect(consolidatedLines.value).toEqual([])
  })

  it('clears previous error on new consolidation attempt', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(makePendingReviewResponse())

    const { consolidationError, consolidate } = useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    expect(consolidationError.value).toBe('Network error')

    await consolidate()
    expect(consolidationError.value).toBeNull()
  })

  it('resets state when planId changes', async () => {
    const scope = effectScope()
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makePendingReviewResponse())

    let composable!: ReturnType<typeof useConsolidatedShoppingList>
    scope.run(() => {
      composable = useConsolidatedShoppingList(planId, { fetchConsolidate })
    })

    const { reviewLines, consolidatedLines, hasConsolidated, consolidate, polishStatus } = composable

    await consolidate()
    expect(hasConsolidated.value).toBe(true)
    expect(reviewLines.value).toHaveLength(2)
    expect(polishStatus.value).toBe('pending_review')

    planId.value = 'plan-2'
    await nextTick()

    expect(hasConsolidated.value).toBe(false)
    expect(reviewLines.value).toEqual([])
    expect(consolidatedLines.value).toEqual([])
    expect(polishStatus.value).toBeNull()

    scope.stop()
  })

  it('discards stale response when a newer consolidation starts before the first completes', async () => {
    const planId = ref('plan-1')
    let resolveFirst: (v: ConsolidationResponse) => void
    let resolveSecond: (v: ConsolidationResponse) => void

    const fetchConsolidate = vi.fn()
      .mockImplementationOnce(() => new Promise<ConsolidationResponse>((res) => { resolveFirst = res }))
      .mockImplementationOnce(() => new Promise<ConsolidationResponse>((res) => { resolveSecond = res }))

    const { reviewLines, consolidate } = useConsolidatedShoppingList(planId, { fetchConsolidate })

    const first = consolidate()
    const second = consolidate()

    const staleResponse = makeAiSkippedResponse()
    const freshResponse = makePendingReviewResponse()

    // Resolve the newer (second) request first, then the stale (first) request
    resolveSecond!(freshResponse)
    await second

    resolveFirst!(staleResponse)
    await first

    // Only the fresh (second) response should be reflected in state
    expect(reviewLines.value).toEqual(freshResponse.consolidatedLines)
  })
})
