/**
 * Tests for auto-consolidation trigger + session draft (issue #0003).
 * Covers: trigger fires once, draft resumes, draft clears on confirm,
 * draft clears on plan switch, trigger blocked when valid list,
 * trigger blocked when already consolidating, fallback held in draft.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick, effectScope } from 'vue'
import {
  useConsolidatedShoppingList,
  _sessionDraftStore,
  type ConsolidationResponse,
} from '../../app/composables/useConsolidatedShoppingList'

function makePendingReviewResponse(): ConsolidationResponse {
  return {
    consolidatedLines: [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ],
    baselineLines: [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ],
    changes: [],
    polishStatus: 'pending_review',
    warnings: [],
    hints: [],
  }
}

function makeBaselineFallbackResponse(): ConsolidationResponse {
  return {
    consolidatedLines: [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ],
    baselineLines: [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ],
    changes: [],
    polishStatus: 'baseline_fallback',
    warnings: ['AI timed out; returning baseline.'],
  }
}

function makeSavedRecord() {
  return {
    lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
    sourceFingerprint: 'abc123',
    confirmedAt: '2026-05-26T10:00:00.000Z',
  }
}

describe('useConsolidatedShoppingList — auto-trigger + session draft', () => {
  beforeEach(() => {
    _sessionDraftStore.clear()
  })

  it('auto-trigger fires when view=consolidated, hydration settled, no valid saved list, no draft', async () => {
    const planId = ref('plan-1')
    const view = ref('recipe-sections')
    const fetchConsolidate = vi.fn().mockResolvedValue(makePendingReviewResponse())
    const fetchSavedList = vi.fn().mockResolvedValue(null)

    const scope = effectScope()
    scope.run(() => {
      useConsolidatedShoppingList(planId, { fetchConsolidate, fetchSavedList, view })
    })

    // Hydration settles with recipe-sections view — trigger must not fire
    await vi.waitFor(() => expect(fetchSavedList).toHaveBeenCalled())
    expect(fetchConsolidate).not.toHaveBeenCalled()

    // Switching to consolidated view triggers auto-consolidation
    view.value = 'consolidated'
    await vi.waitFor(() => expect(fetchConsolidate).toHaveBeenCalledTimes(1))

    scope.stop()
  })

  it('auto-trigger does not fire when a valid saved list is loaded', async () => {
    const planId = ref('plan-1')
    const view = ref('consolidated')
    const fetchConsolidate = vi.fn().mockResolvedValue(makePendingReviewResponse())
    const fetchSavedList = vi.fn().mockResolvedValue(makeSavedRecord())
    const fetchPlanFlags = vi.fn().mockResolvedValue({ hasSavedShoppingList: true, shoppingListDeprecated: false })

    const scope = effectScope()
    scope.run(() => {
      useConsolidatedShoppingList(planId, { fetchConsolidate, fetchSavedList, fetchPlanFlags, view })
    })

    await vi.waitFor(() => expect(fetchSavedList).toHaveBeenCalled())
    await nextTick()
    await nextTick()

    expect(fetchConsolidate).not.toHaveBeenCalled()

    scope.stop()
  })

  it('auto-trigger does not fire while consolidation is already in progress', async () => {
    const planId = ref('plan-1')
    const view = ref('consolidated')
    let resolveConsolidate!: (v: ConsolidationResponse) => void
    const fetchConsolidate = vi.fn(
      () => new Promise<ConsolidationResponse>(res => { resolveConsolidate = res }),
    )
    const fetchSavedList = vi.fn().mockResolvedValue(null)

    const scope = effectScope()
    scope.run(() => {
      useConsolidatedShoppingList(planId, { fetchConsolidate, fetchSavedList, view })
    })

    // Wait for auto-trigger to fire once
    await vi.waitFor(() => expect(fetchConsolidate).toHaveBeenCalledTimes(1))

    // Toggle view while consolidation is still in progress
    view.value = 'recipe-sections'
    await nextTick()
    view.value = 'consolidated'
    await nextTick()

    expect(fetchConsolidate).toHaveBeenCalledTimes(1)

    resolveConsolidate(makePendingReviewResponse())
    scope.stop()
  })

  it('auto-trigger fires only once; second open for same plan resumes draft without a new POST', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makePendingReviewResponse())

    // --- First composable instance ---
    const view1 = ref('consolidated')
    const fetchSavedList1 = vi.fn().mockResolvedValue(null)
    const scope1 = effectScope()
    let composable1!: ReturnType<typeof useConsolidatedShoppingList>
    scope1.run(() => {
      composable1 = useConsolidatedShoppingList(planId, { fetchConsolidate, fetchSavedList: fetchSavedList1, view: view1 })
    })

    await vi.waitFor(() => expect(fetchConsolidate).toHaveBeenCalledTimes(1))
    expect(composable1.polishStatus.value).toBe('pending_review')
    expect(composable1.reviewLines.value).toHaveLength(1)
    scope1.stop()

    // --- Second composable instance (simulate navigate-away and return) ---
    const view2 = ref('consolidated')
    const fetchSavedList2 = vi.fn().mockResolvedValue(null)
    const scope2 = effectScope()
    let composable2!: ReturnType<typeof useConsolidatedShoppingList>
    scope2.run(() => {
      composable2 = useConsolidatedShoppingList(planId, { fetchConsolidate, fetchSavedList: fetchSavedList2, view: view2 })
    })

    // Wait for hydration on second instance
    await vi.waitFor(() => expect(fetchSavedList2).toHaveBeenCalled())
    await nextTick()

    // Must NOT have called consolidate a second time
    expect(fetchConsolidate).toHaveBeenCalledTimes(1)

    // Draft must be restored
    expect(composable2.polishStatus.value).toBe('pending_review')
    expect(composable2.reviewLines.value).toHaveLength(1)

    scope2.stop()
  })

  it('confirm clears the session draft for that plan', async () => {
    const planId = ref('plan-1')
    const view = ref('consolidated')
    const fetchConsolidate = vi.fn().mockResolvedValue(makePendingReviewResponse())
    const fetchSavedList = vi.fn().mockResolvedValue(null)
    const savelist = vi.fn().mockResolvedValue(makeSavedRecord())

    const scope = effectScope()
    let composable!: ReturnType<typeof useConsolidatedShoppingList>
    scope.run(() => {
      composable = useConsolidatedShoppingList(planId, { fetchConsolidate, fetchSavedList, savelist, view })
    })

    await vi.waitFor(() => expect(_sessionDraftStore.has('plan-1')).toBe(true))
    await composable.confirmReview()

    expect(_sessionDraftStore.has('plan-1')).toBe(false)

    scope.stop()
  })

  it('switching to a different plan clears the session draft for the previous plan', async () => {
    const planId = ref('plan-1')
    const view = ref('consolidated')
    const fetchConsolidate = vi.fn().mockResolvedValue(makePendingReviewResponse())
    const fetchSavedList = vi.fn().mockResolvedValue(null)

    const scope = effectScope()
    scope.run(() => {
      useConsolidatedShoppingList(planId, { fetchConsolidate, fetchSavedList, view })
    })

    await vi.waitFor(() => expect(_sessionDraftStore.has('plan-1')).toBe(true))

    planId.value = 'plan-2'
    await nextTick()

    expect(_sessionDraftStore.has('plan-1')).toBe(false)

    scope.stop()
  })

  it('fallback (baseline_fallback) is stored in draft with its warning', async () => {
    const planId = ref('plan-1')
    const view = ref('consolidated')
    const fetchConsolidate = vi.fn().mockResolvedValue(makeBaselineFallbackResponse())
    const fetchSavedList = vi.fn().mockResolvedValue(null)

    const scope = effectScope()
    scope.run(() => {
      useConsolidatedShoppingList(planId, { fetchConsolidate, fetchSavedList, view })
    })

    await vi.waitFor(() => expect(_sessionDraftStore.has('plan-1')).toBe(true))

    const draft = _sessionDraftStore.get('plan-1')
    expect(draft?.polishStatus).toBe('baseline_fallback')
    expect(draft?.warnings[0]).toContain('timed out')

    scope.stop()
  })

  it('explicit reset clears the session draft for the current plan', async () => {
    const planId = ref('plan-1')
    const view = ref('consolidated')
    const fetchConsolidate = vi.fn().mockResolvedValue(makePendingReviewResponse())
    const fetchSavedList = vi.fn().mockResolvedValue(null)

    const scope = effectScope()
    let composable!: ReturnType<typeof useConsolidatedShoppingList>
    scope.run(() => {
      composable = useConsolidatedShoppingList(planId, { fetchConsolidate, fetchSavedList, view })
    })

    await vi.waitFor(() => expect(_sessionDraftStore.has('plan-1')).toBe(true))

    composable.reset()

    expect(_sessionDraftStore.has('plan-1')).toBe(false)

    scope.stop()
  })
})
