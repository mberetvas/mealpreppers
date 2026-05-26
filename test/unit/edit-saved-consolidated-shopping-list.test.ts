/**
 * Tests for Edit saved consolidated shopping list (issue #031).
 * Covers: editSaved flow does not clear saved list until confirm,
 * does not call POST consolidate (no OpenRouter cost),
 * confirm PUTs updates with new confirmedAt and refreshed fingerprint.
 */
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useConsolidatedShoppingList } from '../../app/composables/useConsolidatedShoppingList'
import type { SavedConsolidatedShoppingListRecord } from '../../server/services/shopping-list/consolidatedShoppingListRepository'

function makeSavedRecord(): SavedConsolidatedShoppingListRecord {
  return {
    lines: [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g' },
      { id: 'L2', name: 'olijfolie', quantity: 2, unit: 'el' },
    ],
    sourceFingerprint: 'fp-abc123',
    confirmedAt: '2026-05-26T10:00:00.000Z',
  }
}

describe('useConsolidatedShoppingList — editSaved flow', () => {
  it('editSaved enters pending_review with reviewLines pre-filled from saved lines', async () => {
    const planId = ref('plan-1')
    const savedRecord = makeSavedRecord()
    const fetchSavedList = vi.fn().mockResolvedValue(savedRecord)
    const fetchConsolidate = vi.fn()

    const { loadSavedList, editSaved, polishStatus, reviewLines } =
      useConsolidatedShoppingList(planId, { fetchSavedList, fetchConsolidate })

    await loadSavedList()
    editSaved()

    expect(polishStatus.value).toBe('pending_review')
    expect(reviewLines.value).toHaveLength(2)
    expect(reviewLines.value[0].name).toBe('pasta')
    expect(reviewLines.value[1].name).toBe('olijfolie')
    expect(fetchConsolidate).not.toHaveBeenCalled()
  })

  it('editSaved does not clear savedList', async () => {
    const planId = ref('plan-1')
    const savedRecord = makeSavedRecord()
    const fetchSavedList = vi.fn().mockResolvedValue(savedRecord)

    const { loadSavedList, editSaved, savedList } =
      useConsolidatedShoppingList(planId, { fetchSavedList })

    await loadSavedList()
    expect(savedList.value).not.toBeNull()

    editSaved()
    expect(savedList.value).not.toBeNull()
    expect(savedList.value!.confirmedAt).toBe('2026-05-26T10:00:00.000Z')
  })

  it('editSaved sets baselineLines from saved lines (for reference tab)', async () => {
    const planId = ref('plan-1')
    const savedRecord = makeSavedRecord()
    const fetchSavedList = vi.fn().mockResolvedValue(savedRecord)

    const { loadSavedList, editSaved, baselineLines } =
      useConsolidatedShoppingList(planId, { fetchSavedList })

    await loadSavedList()
    editSaved()

    expect(baselineLines.value).toHaveLength(2)
    expect(baselineLines.value[0].name).toBe('pasta')
  })

  it('editSaved does nothing when no saved list loaded', () => {
    const planId = ref('plan-1')
    const fetchSavedList = vi.fn().mockResolvedValue(null)

    const { editSaved, polishStatus } =
      useConsolidatedShoppingList(planId, { fetchSavedList })

    editSaved()

    expect(polishStatus.value).toBeNull()
  })

  it('editSaved does nothing when shopping list is deprecated', async () => {
    const planId = ref('plan-1')
    const savedRecord = makeSavedRecord()
    const fetchSavedList = vi.fn().mockResolvedValue(savedRecord)
    const fetchPlanFlags = vi.fn().mockResolvedValue({ hasSavedShoppingList: true, shoppingListDeprecated: true })

    const { loadSavedList, editSaved, polishStatus } =
      useConsolidatedShoppingList(planId, { fetchSavedList, fetchPlanFlags })

    await loadSavedList()
    editSaved()

    // Should not enter edit mode when deprecated
    expect(polishStatus.value).not.toBe('pending_review')
  })

  it('edits during editSaved update reviewLines (same as post-consolidation review)', async () => {
    const planId = ref('plan-1')
    const savedRecord = makeSavedRecord()
    const fetchSavedList = vi.fn().mockResolvedValue(savedRecord)

    const { loadSavedList, editSaved, updateReviewLine, reviewLines } =
      useConsolidatedShoppingList(planId, { fetchSavedList })

    await loadSavedList()
    editSaved()
    updateReviewLine('L1', { name: 'fusilli', quantity: 500 })

    expect(reviewLines.value[0].name).toBe('fusilli')
    expect(reviewLines.value[0].quantity).toBe(500)
  })

  it('confirmReview after editSaved persists via PUT without POST consolidate', async () => {
    const planId = ref('plan-1')
    const savedRecord = makeSavedRecord()
    const fetchSavedList = vi.fn().mockResolvedValue(savedRecord)
    const fetchConsolidate = vi.fn()
    const updatedRecord: SavedConsolidatedShoppingListRecord = {
      lines: [
        { id: 'L1', name: 'fusilli', quantity: 500, unit: 'g' },
        { id: 'L2', name: 'olijfolie', quantity: 2, unit: 'el' },
      ],
      sourceFingerprint: 'fp-new',
      confirmedAt: '2026-05-26T14:00:00.000Z',
    }
    const savelist = vi.fn().mockResolvedValue(updatedRecord)

    const { loadSavedList, editSaved, updateReviewLine, confirmReview, savedList, polishStatus, consolidatedLines } =
      useConsolidatedShoppingList(planId, { fetchSavedList, fetchConsolidate, savelist })

    await loadSavedList()
    editSaved()
    updateReviewLine('L1', { name: 'fusilli', quantity: 500 })
    await confirmReview()

    expect(fetchConsolidate).not.toHaveBeenCalled()
    expect(polishStatus.value).toBe('polished')
    expect(consolidatedLines.value[0].name).toBe('fusilli')
    expect(consolidatedLines.value[0].quantity).toBe(500)
    expect(savelist).toHaveBeenCalledWith('plan-1', [
      { id: 'L1', name: 'fusilli', quantity: 500, unit: 'g' },
      { id: 'L2', name: 'olijfolie', quantity: 2, unit: 'el' },
    ])

    // Wait for save to resolve
    await vi.waitFor(() => expect(savedList.value).not.toBeNull())
    expect(savedList.value!.sourceFingerprint).toBe('fp-new')
    expect(savedList.value!.confirmedAt).toBe('2026-05-26T14:00:00.000Z')
  })

  it('savedList is preserved during edit and only updated after confirm', async () => {
    const planId = ref('plan-1')
    const savedRecord = makeSavedRecord()
    const fetchSavedList = vi.fn().mockResolvedValue(savedRecord)
    const updatedRecord: SavedConsolidatedShoppingListRecord = {
      lines: [{ id: 'L1', name: 'fusilli', quantity: 500, unit: 'g' }, { id: 'L2', name: 'olijfolie', quantity: 2, unit: 'el' }],
      sourceFingerprint: 'fp-new',
      confirmedAt: '2026-05-26T14:00:00.000Z',
    }
    const savelist = vi.fn().mockResolvedValue(updatedRecord)

    const { loadSavedList, editSaved, updateReviewLine, confirmReview, savedList } =
      useConsolidatedShoppingList(planId, { fetchSavedList, savelist })

    await loadSavedList()
    const originalConfirmedAt = savedList.value!.confirmedAt

    editSaved()
    // savedList remains unchanged during edit
    expect(savedList.value!.confirmedAt).toBe(originalConfirmedAt)

    updateReviewLine('L1', { name: 'fusilli', quantity: 500 })
    // Still unchanged
    expect(savedList.value!.confirmedAt).toBe(originalConfirmedAt)

    await confirmReview()
    // Now updated
    await vi.waitFor(() => expect(savedList.value!.confirmedAt).toBe('2026-05-26T14:00:00.000Z'))
  })

  it('hints are cleared on editSaved (no hints in edit-only path)', async () => {
    const planId = ref('plan-1')
    const savedRecord = makeSavedRecord()
    const fetchSavedList = vi.fn().mockResolvedValue(savedRecord)

    const { loadSavedList, editSaved, hints } =
      useConsolidatedShoppingList(planId, { fetchSavedList })

    await loadSavedList()
    editSaved()

    expect(hints.value).toHaveLength(0)
  })
})
