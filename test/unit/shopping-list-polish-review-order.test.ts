/**
 * Tests for issue 004: Freeze shopping list polish review order while editing.
 *
 * Covers:
 * - reviewLines are sorted once when pending_review consolidation opens
 * - Editing name/quantity/unit on a review line does not re-sort row order
 * - Hints continue to reference correct line IDs after sorting
 * - editSaved keeps row order fixed while editing
 */
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useConsolidatedShoppingList, type ConsolidationResponse } from '../../app/composables/useConsolidatedShoppingList'
import type { SavedConsolidatedShoppingListRecord } from '../../server/services/shopping-list/consolidatedShoppingListRepository'

/**
 * Returns a pending_review response with lines in WRONG store walk order:
 *   melk (dairy=4), pasta (dry_goods=6), tomaten (produce=0)
 * After sorting they must appear: tomaten, melk, pasta.
 */
function makeUnsortedPendingReviewResponse(): ConsolidationResponse {
  return {
    consolidatedLines: [
      { id: 'L1', name: 'melk', quantity: 1, unit: 'l', provenance: [] },
      { id: 'L2', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
      { id: 'L3', name: 'tomaten', quantity: 400, unit: 'g', provenance: [] },
    ],
    baselineLines: [
      { id: 'L1', name: 'melk', quantity: 1, unit: 'l', provenance: [] },
      { id: 'L2', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
      { id: 'L3', name: 'tomaten', quantity: 400, unit: 'g', provenance: [] },
    ],
    changes: [
      { id: 'L3', reason: 'merged tomato variants' },
    ],
    polishStatus: 'pending_review',
    warnings: [],
    hints: [
      { lineId: 'L3', rule: 'quantity-cap', severity: 'warning', message: 'Quantity capped for line L3' },
    ],
  }
}

/**
 * Returns an unsorted saved record:
 *   melk (dairy), pasta (dry_goods), tomaten (produce)
 * After sorting they must appear: tomaten, melk, pasta.
 */
function makeUnsortedSavedRecord(): SavedConsolidatedShoppingListRecord {
  return {
    lines: [
      { id: 'L1', name: 'melk', quantity: 1, unit: 'l' },
      { id: 'L2', name: 'pasta', quantity: 800, unit: 'g' },
      { id: 'L3', name: 'tomaten', quantity: 400, unit: 'g' },
    ],
    sourceFingerprint: 'fp-unsorted',
    confirmedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('useConsolidatedShoppingList — review entry order (issue 004)', () => {
  it('reviewLines are sorted into store walk order when pending_review consolidation opens', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makeUnsortedPendingReviewResponse())

    const { consolidate, reviewLines } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()

    const names = reviewLines.value.map(l => l.name)
    expect(names).toEqual(['tomaten', 'melk', 'pasta'])
  })

  it('reviewLines preserve line identity (id, quantity, unit) while being sorted on entry', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makeUnsortedPendingReviewResponse())

    const { consolidate, reviewLines } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()

    const byId = Object.fromEntries(reviewLines.value.map(l => [l.id, l]))
    expect(byId['L1']).toMatchObject({ id: 'L1', name: 'melk', quantity: 1, unit: 'l' })
    expect(byId['L2']).toMatchObject({ id: 'L2', name: 'pasta', quantity: 800, unit: 'g' })
    expect(byId['L3']).toMatchObject({ id: 'L3', name: 'tomaten', quantity: 400, unit: 'g' })
  })
})

describe('useConsolidatedShoppingList — stable row order while editing (issue 004)', () => {
  it('editing name to a different aisle category does not re-sort the review row order', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makeUnsortedPendingReviewResponse())

    const { consolidate, reviewLines, updateReviewLine } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    // sorted: [L3=tomaten (produce, idx 0), L1=melk (dairy, idx 1), L2=pasta (dry_goods, idx 2)]
    // Rename L3 (tomaten=produce) to 'paprikapoeder' (spices) — would sort after dairy without freezing
    updateReviewLine('L3', { name: 'paprikapoeder' })

    // Row order must remain frozen — L3 stays at index 0 despite name change
    expect(reviewLines.value[0].id).toBe('L3')
    expect(reviewLines.value[0].name).toBe('paprikapoeder')
    expect(reviewLines.value[1].id).toBe('L1')
    expect(reviewLines.value[2].id).toBe('L2')
  })

  it('editing quantity does not change the review row order', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makeUnsortedPendingReviewResponse())

    const { consolidate, reviewLines, updateReviewLine } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    const orderBefore = reviewLines.value.map(l => l.id)

    updateReviewLine('L1', { quantity: 2 })

    expect(reviewLines.value.map(l => l.id)).toEqual(orderBefore)
  })

  it('editing unit does not change the review row order', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makeUnsortedPendingReviewResponse())

    const { consolidate, reviewLines, updateReviewLine } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()
    const orderBefore = reviewLines.value.map(l => l.id)

    updateReviewLine('L2', { unit: 'kg' })

    expect(reviewLines.value.map(l => l.id)).toEqual(orderBefore)
  })
})

describe('useConsolidatedShoppingList — diff and hints after sorting (issue 004)', () => {
  it('all hint lineIds reference lines present in sorted reviewLines', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makeUnsortedPendingReviewResponse())

    const { consolidate, reviewLines, hints } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()

    const reviewLineIds = new Set(reviewLines.value.map(l => l.id))
    for (const hint of hints.value) {
      expect(reviewLineIds.has(hint.lineId)).toBe(true)
    }
  })

  it('all change IDs reference lines present in sorted reviewLines', async () => {
    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue(makeUnsortedPendingReviewResponse())

    const { consolidate, reviewLines, changes } =
      useConsolidatedShoppingList(planId, { fetchConsolidate })

    await consolidate()

    const reviewLineIds = new Set(reviewLines.value.map(l => l.id))
    for (const change of changes.value) {
      expect(reviewLineIds.has(change.id)).toBe(true)
    }
  })
})

describe('useConsolidatedShoppingList — editSaved review order stability (issue 004)', () => {
  it('editSaved row order remains fixed after renaming a line to a different aisle', async () => {
    const planId = ref('plan-1')
    const fetchSavedList = vi.fn().mockResolvedValue(makeUnsortedSavedRecord())

    const { loadSavedList, editSaved, updateReviewLine, reviewLines } =
      useConsolidatedShoppingList(planId, { fetchSavedList })

    await loadSavedList()
    editSaved()
    // sorted: [L3=tomaten (produce, idx 0), L1=melk (dairy, idx 1), L2=pasta (dry_goods, idx 2)]
    // Rename L3 (tomaten=produce) to 'kerriepoeder' (spices) — would sort after dairy without freezing
    updateReviewLine('L3', { name: 'kerriepoeder' })

    // Row order must remain frozen — L3 stays at index 0
    expect(reviewLines.value[0].id).toBe('L3')
    expect(reviewLines.value[0].name).toBe('kerriepoeder')
    expect(reviewLines.value[1].id).toBe('L1')
    expect(reviewLines.value[2].id).toBe('L2')
  })

  it('editSaved row order remains fixed after editing quantity and unit', async () => {
    const planId = ref('plan-1')
    const fetchSavedList = vi.fn().mockResolvedValue(makeUnsortedSavedRecord())

    const { loadSavedList, editSaved, updateReviewLine, reviewLines } =
      useConsolidatedShoppingList(planId, { fetchSavedList })

    await loadSavedList()
    editSaved()
    const orderBefore = reviewLines.value.map(l => l.id)

    updateReviewLine('L1', { quantity: 500, unit: 'ml' })

    expect(reviewLines.value.map(l => l.id)).toEqual(orderBefore)
  })
})
