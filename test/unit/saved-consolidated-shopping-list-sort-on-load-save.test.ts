/**
 * Tests for issue 003: Sort saved consolidated shopping lists on load and save.
 *
 * Covers:
 * - loadSavedList sorts lines by store walk order before displaying
 * - Older unsorted records are re-ordered on load, preserving id/name/quantity/unit
 * - confirmReview sorts lines before assigning to consolidated display state
 * - editSaved review lines start sorted from saved record
 * - Deprecated saved lists keep deprecation behaviour; sorting does not silence it
 * - Stable repeated refresh order (same sorted result on every load)
 */
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useConsolidatedShoppingList } from '../../app/composables/useConsolidatedShoppingList'
import type { SavedConsolidatedShoppingListRecord } from '../../server/services/shopping-list/consolidatedShoppingListRepository'

/**
 * Returns a saved record whose lines are in the WRONG store walk order:
 *   melk (dairy=4), pasta (dry_goods=6), tomaten (produce=0)
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

/**
 * Returns a saved record already in correct store walk order, used to test
 * stable repeated loading.
 */
function makeSortedSavedRecord(): SavedConsolidatedShoppingListRecord {
  return {
    lines: [
      { id: 'L3', name: 'tomaten', quantity: 400, unit: 'g' },
      { id: 'L1', name: 'melk', quantity: 1, unit: 'l' },
      { id: 'L2', name: 'pasta', quantity: 800, unit: 'g' },
    ],
    sourceFingerprint: 'fp-sorted',
    confirmedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('useConsolidatedShoppingList — sorted load (issue 003)', () => {
  it('loadSavedList displays lines sorted by store walk order', async () => {
    const planId = ref('plan-1')
    const fetchSavedList = vi.fn().mockResolvedValue(makeUnsortedSavedRecord())

    const { loadSavedList, consolidatedLines } =
      useConsolidatedShoppingList(planId, { fetchSavedList })

    await loadSavedList()

    const names = consolidatedLines.value.map(l => l.name)
    expect(names).toEqual(['tomaten', 'melk', 'pasta'])
  })

  it('loadSavedList preserves id, name, quantity and unit while reordering', async () => {
    const planId = ref('plan-1')
    const fetchSavedList = vi.fn().mockResolvedValue(makeUnsortedSavedRecord())

    const { loadSavedList, consolidatedLines } =
      useConsolidatedShoppingList(planId, { fetchSavedList })

    await loadSavedList()

    const byId = Object.fromEntries(consolidatedLines.value.map(l => [l.id, l]))
    expect(byId['L1']).toMatchObject({ id: 'L1', name: 'melk', quantity: 1, unit: 'l' })
    expect(byId['L2']).toMatchObject({ id: 'L2', name: 'pasta', quantity: 800, unit: 'g' })
    expect(byId['L3']).toMatchObject({ id: 'L3', name: 'tomaten', quantity: 400, unit: 'g' })
  })

  it('loadSavedList also sorts baselineLines', async () => {
    const planId = ref('plan-1')
    const fetchSavedList = vi.fn().mockResolvedValue(makeUnsortedSavedRecord())

    const { loadSavedList, baselineLines } =
      useConsolidatedShoppingList(planId, { fetchSavedList })

    await loadSavedList()

    const names = baselineLines.value.map(l => l.name)
    expect(names).toEqual(['tomaten', 'melk', 'pasta'])
  })

  it('stable repeated loadSavedList produces identical sorted order', async () => {
    const planId = ref('plan-1')
    const fetchSavedList = vi.fn().mockResolvedValue(makeUnsortedSavedRecord())

    const { loadSavedList, consolidatedLines } =
      useConsolidatedShoppingList(planId, { fetchSavedList })

    await loadSavedList()
    const firstOrder = consolidatedLines.value.map(l => l.id)

    await loadSavedList()
    const secondOrder = consolidatedLines.value.map(l => l.id)

    expect(secondOrder).toEqual(firstOrder)
  })

  it('already-sorted records remain in the same order after load', async () => {
    const planId = ref('plan-1')
    const fetchSavedList = vi.fn().mockResolvedValue(makeSortedSavedRecord())

    const { loadSavedList, consolidatedLines } =
      useConsolidatedShoppingList(planId, { fetchSavedList })

    await loadSavedList()

    const names = consolidatedLines.value.map(l => l.name)
    expect(names).toEqual(['tomaten', 'melk', 'pasta'])
  })
})

describe('useConsolidatedShoppingList — deprecated list sorting behaviour (issue 003)', () => {
  it('deprecated saved list is still detected as deprecated after loadSavedList', async () => {
    const planId = ref('plan-1')
    const fetchSavedList = vi.fn().mockResolvedValue(makeUnsortedSavedRecord())
    const fetchPlanFlags = vi.fn().mockResolvedValue({
      hasSavedShoppingList: true,
      shoppingListDeprecated: true,
    })

    const { loadSavedList, shoppingListDeprecated } =
      useConsolidatedShoppingList(planId, { fetchSavedList, fetchPlanFlags })

    await loadSavedList()

    expect(shoppingListDeprecated.value).toBe(true)
  })

  it('sorting on load does not suppress the deprecated flag', async () => {
    const planId = ref('plan-1')
    const record = makeUnsortedSavedRecord()
    const fetchSavedList = vi.fn().mockResolvedValue(record)
    const fetchPlanFlags = vi.fn().mockResolvedValue({
      hasSavedShoppingList: true,
      shoppingListDeprecated: true,
    })

    const { loadSavedList, consolidatedLines, shoppingListDeprecated } =
      useConsolidatedShoppingList(planId, { fetchSavedList, fetchPlanFlags })

    await loadSavedList()

    // Lines should be sorted
    expect(consolidatedLines.value.map(l => l.name)).toEqual(['tomaten', 'melk', 'pasta'])
    // But deprecated flag must remain set
    expect(shoppingListDeprecated.value).toBe(true)
  })
})

describe('useConsolidatedShoppingList — confirmReview sorts display lines (issue 003)', () => {
  it('confirmReview assigns sorted lines to consolidatedLines after save', async () => {
    const planId = ref('plan-1')

    const fetchConsolidate = vi.fn().mockResolvedValue({
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
      changes: [],
      polishStatus: 'pending_review',
      warnings: [],
    })

    const savedRecord: SavedConsolidatedShoppingListRecord = {
      lines: [
        { id: 'L1', name: 'melk', quantity: 1, unit: 'l' },
        { id: 'L2', name: 'pasta', quantity: 800, unit: 'g' },
        { id: 'L3', name: 'tomaten', quantity: 400, unit: 'g' },
      ],
      sourceFingerprint: 'fp',
      confirmedAt: '2026-05-26T12:00:00.000Z',
    }
    const savelist = vi.fn().mockResolvedValue(savedRecord)

    const { consolidate, confirmReview, consolidatedLines } =
      useConsolidatedShoppingList(planId, { fetchConsolidate, savelist })

    await consolidate()
    await confirmReview()

    const names = consolidatedLines.value.map(l => l.name)
    expect(names).toEqual(['tomaten', 'melk', 'pasta'])
  })

  it('confirmReview PUT payload is aisle-sorted even when reviewLines are out of order', async () => {
    const planId = ref('plan-1')

    const fetchConsolidate = vi.fn().mockResolvedValue({
      consolidatedLines: [
        { id: 'L1', name: 'melk', quantity: 1, unit: 'l', provenance: [] },
        { id: 'L2', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
        { id: 'L3', name: 'tomaten', quantity: 400, unit: 'g', provenance: [] },
      ],
      baselineLines: [],
      changes: [],
      polishStatus: 'pending_review',
      warnings: [],
    })

    const savedRecord: SavedConsolidatedShoppingListRecord = {
      lines: [
        { id: 'L3', name: 'tomaten', quantity: 400, unit: 'g' },
        { id: 'L1', name: 'melk', quantity: 1, unit: 'l' },
        { id: 'L2', name: 'pasta', quantity: 800, unit: 'g' },
      ],
      sourceFingerprint: 'fp',
      confirmedAt: '2026-05-26T12:00:00.000Z',
    }
    const savelist = vi.fn().mockResolvedValue(savedRecord)

    const { consolidate, confirmReview, reviewLines } =
      useConsolidatedShoppingList(planId, { fetchConsolidate, savelist })

    await consolidate()
    reviewLines.value = [
      { id: 'L2', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
      { id: 'L1', name: 'melk', quantity: 1, unit: 'l', provenance: [] },
      { id: 'L3', name: 'tomaten', quantity: 400, unit: 'g', provenance: [] },
    ]
    await confirmReview()

    expect(savelist).toHaveBeenCalled()
    const putLines = savelist.mock.calls[0][1] as { name: string }[]
    expect(putLines.map(l => l.name)).toEqual(['tomaten', 'melk', 'pasta'])
  })

  it('confirmReview preserves line content (id, quantity, unit) while sorting', async () => {
    const planId = ref('plan-1')

    const fetchConsolidate = vi.fn().mockResolvedValue({
      consolidatedLines: [
        { id: 'L1', name: 'melk', quantity: 1, unit: 'l', provenance: [] },
        { id: 'L2', name: 'tomaten', quantity: 400, unit: 'g', provenance: [] },
      ],
      baselineLines: [],
      changes: [],
      polishStatus: 'pending_review',
      warnings: [],
    })

    const savedRecord: SavedConsolidatedShoppingListRecord = {
      lines: [
        { id: 'L1', name: 'melk', quantity: 1, unit: 'l' },
        { id: 'L2', name: 'tomaten', quantity: 400, unit: 'g' },
      ],
      sourceFingerprint: 'fp',
      confirmedAt: '2026-05-26T12:00:00.000Z',
    }
    const savelist = vi.fn().mockResolvedValue(savedRecord)

    const { consolidate, confirmReview, consolidatedLines } =
      useConsolidatedShoppingList(planId, { fetchConsolidate, savelist })

    await consolidate()
    await confirmReview()

    const byId = Object.fromEntries(consolidatedLines.value.map(l => [l.id, l]))
    expect(byId['L1']).toMatchObject({ id: 'L1', name: 'melk', quantity: 1, unit: 'l' })
    expect(byId['L2']).toMatchObject({ id: 'L2', name: 'tomaten', quantity: 400, unit: 'g' })
  })
})

describe('useConsolidatedShoppingList — editSaved starts with sorted lines (issue 003)', () => {
  it('editSaved pre-fills reviewLines in store walk order', async () => {
    const planId = ref('plan-1')
    const fetchSavedList = vi.fn().mockResolvedValue(makeUnsortedSavedRecord())

    const { loadSavedList, editSaved, reviewLines } =
      useConsolidatedShoppingList(planId, { fetchSavedList })

    await loadSavedList()
    editSaved()

    const names = reviewLines.value.map(l => l.name)
    expect(names).toEqual(['tomaten', 'melk', 'pasta'])
  })
})
