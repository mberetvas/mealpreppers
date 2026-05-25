import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useConsolidatedShoppingList, type ConsolidationResponse } from '../../app/composables/useConsolidatedShoppingList'

function makeSuccessResponse(): ConsolidationResponse {
  return {
    consolidatedLines: [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [{ recipeId: 'r1', recipeTitle: 'Pasta' }] },
      { id: 'L2', name: 'olijfolie', quantity: 4, unit: 'el', provenance: [{ recipeId: 'r1', recipeTitle: 'Pasta' }] },
    ],
    baselineLines: [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [{ recipeId: 'r1', recipeTitle: 'Pasta' }] },
      { id: 'L2', name: 'olijfolie', quantity: 4, unit: 'el', provenance: [{ recipeId: 'r1', recipeTitle: 'Pasta' }] },
    ],
    changes: [],
    polishStatus: 'polished',
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

    resolvePromise!(makeSuccessResponse())
    await promise
    expect(consolidating.value).toBe(false)
  })

  it('stores consolidated lines on success', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makeSuccessResponse())

    const { consolidatedLines, polishStatus, hasConsolidated, consolidate } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    expect(consolidatedLines.value).toHaveLength(2)
    expect(polishStatus.value).toBe('polished')
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
    const fetchConsolidate = vi.fn().mockResolvedValue(makeSuccessResponse())

    const { consolidate } = useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    await consolidate()
    expect(fetchConsolidate).toHaveBeenCalledTimes(2)
  })

  it('reset clears all state', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makeSuccessResponse())

    const { consolidatedLines, hasConsolidated, consolidate, reset } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    expect(hasConsolidated.value).toBe(true)
    expect(consolidatedLines.value).toHaveLength(2)

    reset()
    expect(hasConsolidated.value).toBe(false)
    expect(consolidatedLines.value).toEqual([])
  })

  it('clears previous error on new consolidation attempt', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(makeSuccessResponse())

    const { consolidationError, consolidate } = useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    expect(consolidationError.value).toBe('Network error')

    await consolidate()
    expect(consolidationError.value).toBeNull()
  })
})
