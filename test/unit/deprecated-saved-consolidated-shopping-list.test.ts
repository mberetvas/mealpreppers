/**
 * Tests for Deprecated saved consolidated shopping list (issue #030).
 * Covers: composable deprecated detection, API PUT rejection when deprecated,
 * and re-consolidate flow after deprecation.
 */
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MergedLine } from '../../server/services/shopping-list/exactMerge'
import {
  saveConsolidatedShoppingList,
  computeShoppingListFlags,
  type SavedConsolidatedShoppingListRecord,
} from '../../server/services/shopping-list/consolidatedShoppingListRepository'
import { computeSourceFingerprint } from '../../server/services/shopping-list/sourceFingerprint'
import type { WeekPlanV1 } from '../../types/planning'

// --- Helpers ---

function makeWeekPlanBody(overrides?: Partial<WeekPlanV1['days']>): WeekPlanV1 {
  const emptySlot = { recipeId: null }
  const day = { breakfast: emptySlot, lunch: emptySlot, dinner: emptySlot }
  return {
    version: 'week_v1',
    days: {
      '1': day,
      '2': day,
      '3': day,
      '4': day,
      '5': day,
      '6': day,
      '7': day,
      ...overrides,
    },
  }
}

function makeSavedLines(): MergedLine[] {
  return [
    { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [{ recipeId: 'r1', recipeTitle: 'Pasta' }] },
    { id: 'L2', name: 'olijfolie', quantity: 2, unit: 'el', provenance: [{ recipeId: 'r1', recipeTitle: 'Pasta' }] },
  ]
}

// --- computeShoppingListFlags: deprecated detection ---

describe('computeShoppingListFlags — deprecated detection', () => {
  it('shoppingListDeprecated is true when plan body changes after save', () => {
    const originalBody = makeWeekPlanBody({
      '1': { breakfast: { recipeId: 'recipe-a' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
    })
    const record: SavedConsolidatedShoppingListRecord = {
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
      sourceFingerprint: computeSourceFingerprint(originalBody),
      confirmedAt: '2026-05-26T10:00:00.000Z',
    }

    const modifiedBody = makeWeekPlanBody({
      '1': { breakfast: { recipeId: 'recipe-b' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
    })

    const flags = computeShoppingListFlags(record, modifiedBody)

    expect(flags.hasSavedShoppingList).toBe(true)
    expect(flags.shoppingListDeprecated).toBe(true)
  })

  it('shoppingListDeprecated is false when plan body matches stored fingerprint', () => {
    const body = makeWeekPlanBody({
      '1': { breakfast: { recipeId: 'recipe-a' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
    })
    const record: SavedConsolidatedShoppingListRecord = {
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
      sourceFingerprint: computeSourceFingerprint(body),
      confirmedAt: '2026-05-26T10:00:00.000Z',
    }

    const flags = computeShoppingListFlags(record, body)

    expect(flags.hasSavedShoppingList).toBe(true)
    expect(flags.shoppingListDeprecated).toBe(false)
  })

  it('shoppingListDeprecated is false when no saved list exists', () => {
    const body = makeWeekPlanBody()

    const flags = computeShoppingListFlags(null, body)

    expect(flags.hasSavedShoppingList).toBe(false)
    expect(flags.shoppingListDeprecated).toBe(false)
  })
})

// --- API PUT rejection when deprecated ---

describe('saveConsolidatedShoppingList — rejection when deprecated', () => {
  it('rejects PUT with deprecated_list error when existing list fingerprint does not match current body', async () => {
    const originalBody = makeWeekPlanBody({
      '1': { breakfast: { recipeId: 'recipe-a' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
    })
    const existingRecord: SavedConsolidatedShoppingListRecord = {
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
      sourceFingerprint: computeSourceFingerprint(originalBody),
      confirmedAt: '2026-05-25T10:00:00.000Z',
    }

    // Body has been changed since the list was saved
    const changedBody = makeWeekPlanBody({
      '1': { breakfast: { recipeId: 'recipe-b' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
    })

    const client = mockSupabaseClientForSave({
      selectResult: {
        id: 'plan-1',
        body: changedBody,
        owner_user_id: null,
        anon_session_id: 'sess-1',
        consolidated_shopping_list: existingRecord,
      },
    })

    const result = await saveConsolidatedShoppingList(
      client,
      'plan-1',
      { kind: 'anonymous', sessionId: 'sess-1' },
      makeSavedLines(),
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('deprecated_list')
    }
  })

  it('allows PUT when no existing list is stored (first save)', async () => {
    const body = makeWeekPlanBody({
      '1': { breakfast: { recipeId: 'recipe-a' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
    })

    const client = mockSupabaseClientForSave({
      selectResult: {
        id: 'plan-1',
        body,
        owner_user_id: null,
        anon_session_id: 'sess-1',
        consolidated_shopping_list: null,
      },
    })

    const result = await saveConsolidatedShoppingList(
      client,
      'plan-1',
      { kind: 'anonymous', sessionId: 'sess-1' },
      makeSavedLines(),
    )

    expect(result.ok).toBe(true)
  })

  it('allows PUT when existing list fingerprint matches current body (fresh consolidation)', async () => {
    const body = makeWeekPlanBody({
      '1': { breakfast: { recipeId: 'recipe-a' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
    })
    const existingRecord: SavedConsolidatedShoppingListRecord = {
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
      sourceFingerprint: computeSourceFingerprint(body),
      confirmedAt: '2026-05-25T10:00:00.000Z',
    }

    const client = mockSupabaseClientForSave({
      selectResult: {
        id: 'plan-1',
        body,
        owner_user_id: null,
        anon_session_id: 'sess-1',
        consolidated_shopping_list: existingRecord,
      },
    })

    const result = await saveConsolidatedShoppingList(
      client,
      'plan-1',
      { kind: 'anonymous', sessionId: 'sess-1' },
      makeSavedLines(),
    )

    expect(result.ok).toBe(true)
  })
})

// --- Composable: deprecated state detection on loadSavedList ---

describe('useConsolidatedShoppingList — deprecated state', () => {
  it('sets shoppingListDeprecated when loaded list fingerprint does not match plan body', async () => {
    const { ref } = await import('vue')
    const { useConsolidatedShoppingList } = await import('../../app/composables/useConsolidatedShoppingList')

    const planId = ref('plan-1')
    const originalBody = makeWeekPlanBody({
      '1': { breakfast: { recipeId: 'recipe-a' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
    })
    const savedRecord: SavedConsolidatedShoppingListRecord = {
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
      sourceFingerprint: computeSourceFingerprint(originalBody),
      confirmedAt: '2026-05-26T10:00:00.000Z',
    }

    // The plan body has since changed (fingerprint no longer matches savedRecord.sourceFingerprint)
    const _changedFingerprint = computeSourceFingerprint(makeWeekPlanBody({
      '1': { breakfast: { recipeId: 'recipe-b' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
    }))

    const fetchSavedList = vi.fn().mockResolvedValue(savedRecord)
    const fetchPlanFlags = vi.fn().mockResolvedValue({
      hasSavedShoppingList: true,
      shoppingListDeprecated: true,
    })

    const composable = useConsolidatedShoppingList(planId, {
      fetchSavedList,
      fetchPlanFlags,
    })

    await composable.loadSavedList()

    expect(composable.shoppingListDeprecated.value).toBe(true)
    expect(composable.consolidatedLines.value).toHaveLength(1)
    expect(composable.savedListHydrationSettled.value).toBe(true)
  })

  it('does not expose polished state before plan flags resolve', async () => {
    const { ref } = await import('vue')
    const { useConsolidatedShoppingList } = await import('../../app/composables/useConsolidatedShoppingList')

    const planId = ref('plan-1')
    const savedRecord: SavedConsolidatedShoppingListRecord = {
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
      sourceFingerprint: 'fp-old',
      confirmedAt: '2026-05-26T10:00:00.000Z',
    }

    let resolveFlags!: (value: { hasSavedShoppingList: boolean, shoppingListDeprecated: boolean }) => void
    const fetchPlanFlags = vi.fn(
      () => new Promise<{ hasSavedShoppingList: boolean, shoppingListDeprecated: boolean }>((resolve) => {
        resolveFlags = resolve
      }),
    )
    const fetchSavedList = vi.fn().mockResolvedValue(savedRecord)

    const composable = useConsolidatedShoppingList(planId, { fetchSavedList, fetchPlanFlags })
    const loadPromise = composable.loadSavedList()
    await Promise.resolve()

    expect(composable.polishStatus.value).toBeNull()
    expect(composable.savedListHydrationSettled.value).toBe(false)

    resolveFlags!({ hasSavedShoppingList: true, shoppingListDeprecated: true })
    await loadPromise

    expect(composable.shoppingListDeprecated.value).toBe(true)
    expect(composable.polishStatus.value).toBe('polished')
    expect(composable.savedListHydrationSettled.value).toBe(true)
  })

  it('does not set deprecated when fingerprint matches', async () => {
    const { ref } = await import('vue')
    const { useConsolidatedShoppingList } = await import('../../app/composables/useConsolidatedShoppingList')

    const planId = ref('plan-1')
    const body = makeWeekPlanBody({
      '1': { breakfast: { recipeId: 'recipe-a' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
    })
    const savedRecord: SavedConsolidatedShoppingListRecord = {
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
      sourceFingerprint: computeSourceFingerprint(body),
      confirmedAt: '2026-05-26T10:00:00.000Z',
    }

    const fetchSavedList = vi.fn().mockResolvedValue(savedRecord)
    const fetchPlanFlags = vi.fn().mockResolvedValue({
      hasSavedShoppingList: true,
      shoppingListDeprecated: false,
    })

    const composable = useConsolidatedShoppingList(planId, {
      fetchSavedList,
      fetchPlanFlags,
    })

    await composable.loadSavedList()

    expect(composable.shoppingListDeprecated.value).toBe(false)
  })

  it('confirmReview is blocked when list is deprecated (must re-consolidate first)', async () => {
    const { ref } = await import('vue')
    const { useConsolidatedShoppingList } = await import('../../app/composables/useConsolidatedShoppingList')

    const planId = ref('plan-1')
    const body = makeWeekPlanBody({
      '1': { breakfast: { recipeId: 'recipe-a' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
    })
    const savedRecord: SavedConsolidatedShoppingListRecord = {
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
      sourceFingerprint: computeSourceFingerprint(body),
      confirmedAt: '2026-05-26T10:00:00.000Z',
    }

    const fetchSavedList = vi.fn().mockResolvedValue(savedRecord)
    const fetchPlanFlags = vi.fn().mockResolvedValue({
      hasSavedShoppingList: true,
      shoppingListDeprecated: true,
    })
    const savelist = vi.fn()

    const composable = useConsolidatedShoppingList(planId, {
      fetchSavedList,
      fetchPlanFlags,
      savelist,
    })

    await composable.loadSavedList()
    expect(composable.shoppingListDeprecated.value).toBe(true)

    // Attempt confirmReview — should be a no-op (deprecated blocks it)
    await composable.confirmReview()
    expect(savelist).not.toHaveBeenCalled()
  })

  it('consolidate clears deprecated state and starts fresh review', async () => {
    const { ref } = await import('vue')
    const { useConsolidatedShoppingList } = await import('../../app/composables/useConsolidatedShoppingList')

    const planId = ref('plan-1')
    const body = makeWeekPlanBody({
      '1': { breakfast: { recipeId: 'recipe-a' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
    })
    const savedRecord: SavedConsolidatedShoppingListRecord = {
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
      sourceFingerprint: computeSourceFingerprint(body),
      confirmedAt: '2026-05-26T10:00:00.000Z',
    }

    const fetchSavedList = vi.fn().mockResolvedValue(savedRecord)
    const fetchPlanFlags = vi.fn().mockResolvedValue({
      hasSavedShoppingList: true,
      shoppingListDeprecated: true,
    })
    const fetchConsolidate = vi.fn().mockResolvedValue({
      consolidatedLines: [
        { id: 'L1', name: 'tomaten', quantity: 600, unit: 'g', provenance: [] },
      ],
      baselineLines: [
        { id: 'L1', name: 'tomaten', quantity: 600, unit: 'g', provenance: [] },
      ],
      changes: [],
      polishStatus: 'pending_review',
      warnings: [],
      hints: [],
    })

    const composable = useConsolidatedShoppingList(planId, {
      fetchSavedList,
      fetchPlanFlags,
      fetchConsolidate,
    })

    await composable.loadSavedList()
    expect(composable.shoppingListDeprecated.value).toBe(true)

    await composable.consolidate()
    expect(composable.shoppingListDeprecated.value).toBe(false)
    expect(composable.polishStatus.value).toBe('pending_review')
  })

  it('confirmReview after fresh consolidation saves new list with fresh fingerprint', async () => {
    const { ref } = await import('vue')
    const { useConsolidatedShoppingList } = await import('../../app/composables/useConsolidatedShoppingList')

    const planId = ref('plan-1')
    const body = makeWeekPlanBody({
      '1': { breakfast: { recipeId: 'recipe-a' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
    })
    const savedRecord: SavedConsolidatedShoppingListRecord = {
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
      sourceFingerprint: 'old-stale-fingerprint',
      confirmedAt: '2026-05-26T10:00:00.000Z',
    }

    const fetchSavedList = vi.fn().mockResolvedValue(savedRecord)
    const fetchPlanFlags = vi.fn().mockResolvedValue({
      hasSavedShoppingList: true,
      shoppingListDeprecated: true,
    })
    const fetchConsolidate = vi.fn().mockResolvedValue({
      consolidatedLines: [
        { id: 'L1', name: 'tomaten', quantity: 600, unit: 'g', provenance: [] },
      ],
      baselineLines: [
        { id: 'L1', name: 'tomaten', quantity: 600, unit: 'g', provenance: [] },
      ],
      changes: [],
      polishStatus: 'pending_review',
      warnings: [],
      hints: [],
    })

    const freshFingerprint = computeSourceFingerprint(body)
    const savedResult: SavedConsolidatedShoppingListRecord = {
      lines: [{ id: 'L1', name: 'tomaten', quantity: 600, unit: 'g' }],
      sourceFingerprint: freshFingerprint,
      confirmedAt: '2026-05-26T12:00:00.000Z',
    }
    const savelist = vi.fn().mockResolvedValue(savedResult)

    const composable = useConsolidatedShoppingList(planId, {
      fetchSavedList,
      fetchPlanFlags,
      fetchConsolidate,
      savelist,
    })

    await composable.loadSavedList()
    await composable.consolidate()
    await composable.confirmReview()

    expect(savelist).toHaveBeenCalled()
    expect(composable.shoppingListDeprecated.value).toBe(false)
    expect(composable.polishStatus.value).toBe('polished')
  })
})

// --- Supabase mock helpers ---

function mockSupabaseClientForSave(opts: {
  selectResult: Record<string, unknown> | null
  updateFn?: ReturnType<typeof vi.fn>
  error?: { message: string }
}) {
  const updateFn = opts.updateFn ?? vi.fn()
  const maybeSingle = vi.fn(async () => ({
    data: opts.selectResult,
    error: opts.error ?? null,
  }))
  const selectEq = vi.fn(() => ({ maybeSingle }))
  const selectFn = vi.fn(() => ({ eq: selectEq }))

  // For update path: chain update → eq → select → single
  const updateSingle = vi.fn(async () => ({ data: { id: 'plan-1' }, error: null }))
  const updateSelect = vi.fn(() => ({ single: updateSingle }))
  const updateEq = vi.fn(() => ({ select: updateSelect }))
  updateFn.mockReturnValue({ eq: updateEq })

  const from = vi.fn((_table: string) => {
    return {
      select: selectFn,
      update: updateFn,
    }
  })

  return { from } as unknown as SupabaseClient
}
