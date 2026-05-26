import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useConsolidatedShoppingList, type ConsolidationResponse } from '../../app/composables/useConsolidatedShoppingList'
import type { PolishHint } from '../../server/services/shopping-list/polishHintBuilder'

function makePendingReviewResponse(): ConsolidationResponse {
  return {
    consolidatedLines: [
      { id: 'L1', name: 'tomaten', quantity: 600, unit: 'g', provenance: [{ recipeId: 'r1', recipeTitle: 'Pasta' }] },
      { id: 'L2', name: 'olijfolie', quantity: 4, unit: 'el', provenance: [{ recipeId: 'r1', recipeTitle: 'Pasta' }] },
    ],
    baselineLines: [
      { id: 'L1', name: 'tomaten', quantity: 400, unit: 'g', provenance: [{ recipeId: 'r1', recipeTitle: 'Pasta' }] },
      { id: 'L2', name: 'olijfolie', quantity: 4, unit: 'el', provenance: [{ recipeId: 'r1', recipeTitle: 'Pasta' }] },
    ],
    changes: [{ id: 'L1', reason: 'merged tomato variants' }],
    polishStatus: 'pending_review',
    warnings: [],
    hints: [
      { lineId: 'L1', rule: 'quantity-cap', severity: 'error', message: 'Quantity 600 exceeds baseline cap 400 for line "L1"' },
    ],
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
    warnings: ['AI polish timed out; returning baseline.'],
  }
}

describe('useConsolidatedShoppingList — pending_review flow', () => {
  it('stores hints when polishStatus is pending_review', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makePendingReviewResponse())

    const { polishStatus, hints, consolidate } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    expect(polishStatus.value).toBe('pending_review')
    expect(hints.value).toHaveLength(1)
    expect(hints.value[0].severity).toBe('error')
  })

  it('tracks edits to review lines by lineId', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makePendingReviewResponse())

    const { consolidate, updateReviewLine, reviewLines } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    updateReviewLine('L1', { name: 'cherry tomaten', quantity: 400 })

    const edited = reviewLines.value.find(l => l.id === 'L1')
    expect(edited?.name).toBe('cherry tomaten')
    expect(edited?.quantity).toBe(400)
  })

  it('does not allow adding new line IDs via updateReviewLine', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makePendingReviewResponse())

    const { consolidate, updateReviewLine, reviewLines } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    updateReviewLine('INVENTED', { name: 'fake', quantity: 1 })

    expect(reviewLines.value.find(l => l.id === 'INVENTED')).toBeUndefined()
  })

  it('confirmReview applies edited lines to consolidatedLines and sets status to polished', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makePendingReviewResponse())

    const { consolidate, updateReviewLine, confirmReview, consolidatedLines, polishStatus } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    updateReviewLine('L1', { name: 'cherry tomaten', quantity: 400 })
    confirmReview()

    expect(polishStatus.value).toBe('polished')
    expect(consolidatedLines.value[0].name).toBe('cherry tomaten')
    expect(consolidatedLines.value[0].quantity).toBe(400)
    expect(consolidatedLines.value[1].name).toBe('olijfolie')
  })

  it('confirmReview clears hints', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makePendingReviewResponse())

    const { consolidate, confirmReview, hints } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    expect(hints.value).toHaveLength(1)

    confirmReview()
    expect(hints.value).toHaveLength(0)
  })

  it('baseline_fallback still shows existing warning UX without review', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makeBaselineFallbackResponse())

    const { consolidate, polishStatus, warnings, hints } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    expect(polishStatus.value).toBe('baseline_fallback')
    expect(warnings.value[0]).toContain('timed out')
    expect(hints.value).toHaveLength(0)
  })

  it('reset clears review state including hints and reviewLines', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makePendingReviewResponse())

    const { consolidate, hints, reviewLines, reset } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    expect(hints.value).toHaveLength(1)
    expect(reviewLines.value).toHaveLength(2)

    reset()
    expect(hints.value).toHaveLength(0)
    expect(reviewLines.value).toHaveLength(0)
  })
})
