/**
 * Tests for Copy-on-match on POST saved-weekplan create (issue #0005).
 * Covers: match found → copy + flag set; no match → no copy; deprecated source → no copy;
 * multiple matches → latest confirmedAt wins; different principal → no copy; PATCH → no copy.
 */
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  copyConsolidatedListFromMatchingPlan,
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

/**
 * Returns a Proxy that accepts any chain of method calls and resolves with `result` when awaited.
 * Used to mock Supabase query builder chains of arbitrary depth.
 */
function makeFlexProxy<T>(result: T) {
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === 'then') {
        return (resolve: (v: T) => unknown, reject: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject)
      }
      return () => new Proxy({}, handler)
    },
  }
  return new Proxy({}, handler)
}

interface CopyClientOpts {
  selectRows: Record<string, unknown>[]
  selectError?: { message: string }
  updateError?: { message: string }
}

/** Mocks a Supabase client for copyConsolidatedListFromMatchingPlan.
 * First `from` call is for the SELECT; second is for the UPDATE.
 */
function makeCopyClient(opts: CopyClientOpts) {
  const from = vi.fn()
    .mockReturnValueOnce({
      select: () => makeFlexProxy({ data: opts.selectRows, error: opts.selectError ?? null }),
    })
    .mockReturnValueOnce({
      update: () => makeFlexProxy({ data: [{ id: 'new-plan' }], error: opts.updateError ?? null }),
    })
  return { from } as unknown as SupabaseClient
}

// --- Tests ---

describe('copyConsolidatedListFromMatchingPlan', () => {
  describe('match found → copy + flag set', () => {
    it('copies list to the new plan when a matching non-deprecated plan exists', async () => {
      const body = makeWeekPlanBody({
        '1': { breakfast: { recipeId: 'r1' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
      })
      const fingerprint = computeSourceFingerprint(body)
      const sourceList: SavedConsolidatedShoppingListRecord = {
        lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
        sourceFingerprint: fingerprint,
        confirmedAt: '2026-05-26T10:00:00.000Z',
      }
      const client = makeCopyClient({
        selectRows: [{ id: 'source-plan', body, consolidated_shopping_list: sourceList, owner_user_id: 'user-1', anon_session_id: null }],
      })

      const result = await copyConsolidatedListFromMatchingPlan(client, 'new-plan', { kind: 'user', userId: 'user-1' }, fingerprint)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.copied).toBe(true)
        expect(result.value.copiedList).toEqual(sourceList)
      }
    })

    it('writes the copied list to the new plan via update', async () => {
      const body = makeWeekPlanBody({
        '2': { breakfast: { recipeId: 'r2' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
      })
      const fingerprint = computeSourceFingerprint(body)
      const sourceList: SavedConsolidatedShoppingListRecord = {
        lines: [{ id: 'L1', name: 'melk', quantity: 1, unit: 'l' }],
        sourceFingerprint: fingerprint,
        confirmedAt: '2026-05-25T08:00:00.000Z',
      }
      const updateFn = vi.fn(() => makeFlexProxy({ data: [{ id: 'new-plan' }], error: null }))
      const from = vi.fn()
        .mockReturnValueOnce({
          select: () => makeFlexProxy({ data: [{ id: 'source-plan', body, consolidated_shopping_list: sourceList, owner_user_id: 'user-1', anon_session_id: null }], error: null }),
        })
        .mockReturnValueOnce({ update: updateFn })
      const client = { from } as unknown as SupabaseClient

      await copyConsolidatedListFromMatchingPlan(client, 'new-plan', { kind: 'user', userId: 'user-1' }, fingerprint)

      expect(updateFn).toHaveBeenCalledWith({ consolidated_shopping_list: sourceList })
    })
  })

  describe('no match → no copy', () => {
    it('returns { copied: false } when no plans exist for the principal', async () => {
      const body = makeWeekPlanBody()
      const fingerprint = computeSourceFingerprint(body)
      const client = makeCopyClient({ selectRows: [] })

      const result = await copyConsolidatedListFromMatchingPlan(client, 'new-plan', { kind: 'user', userId: 'user-1' }, fingerprint)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.copied).toBe(false)
      }
    })

    it('returns { copied: false } when no existing plan fingerprint matches', async () => {
      const body = makeWeekPlanBody({
        '1': { breakfast: { recipeId: 'r1' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
      })
      const differentBody = makeWeekPlanBody({
        '3': { breakfast: { recipeId: 'r-other' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
      })
      const fingerprintOfNew = computeSourceFingerprint(body)
      const sourceList: SavedConsolidatedShoppingListRecord = {
        lines: [{ id: 'L1', name: 'kaas', quantity: 200, unit: 'g' }],
        sourceFingerprint: computeSourceFingerprint(differentBody),
        confirmedAt: '2026-05-24T10:00:00.000Z',
      }
      // source plan has differentBody, so its sourceFingerprint ≠ fingerprintOfNew
      const client = makeCopyClient({
        selectRows: [{ id: 'source-plan', body: differentBody, consolidated_shopping_list: sourceList, owner_user_id: 'user-1', anon_session_id: null }],
      })

      const result = await copyConsolidatedListFromMatchingPlan(client, 'new-plan', { kind: 'user', userId: 'user-1' }, fingerprintOfNew)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.copied).toBe(false)
      }
    })
  })

  describe('deprecated source → no copy', () => {
    it('skips source when its consolidated list is deprecated relative to its own body', async () => {
      // The source plan body has changed after the list was confirmed
      const originalSourceBody = makeWeekPlanBody({
        '1': { breakfast: { recipeId: 'r1' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
      })
      const fingerprintOfOriginal = computeSourceFingerprint(originalSourceBody)

      // Source plan body is now different (plan was edited after confirming the list)
      const updatedSourceBody = makeWeekPlanBody({
        '1': { breakfast: { recipeId: 'r1' }, lunch: { recipeId: 'r2' }, dinner: { recipeId: null } },
      })
      // The confirmed list still has the OLD fingerprint — deprecated
      const sourceList: SavedConsolidatedShoppingListRecord = {
        lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
        sourceFingerprint: fingerprintOfOriginal,
        confirmedAt: '2026-05-26T10:00:00.000Z',
      }

      // new plan has the same body as the original source body
      const client = makeCopyClient({
        selectRows: [{ id: 'source-plan', body: updatedSourceBody, consolidated_shopping_list: sourceList, owner_user_id: 'user-1', anon_session_id: null }],
      })

      const result = await copyConsolidatedListFromMatchingPlan(client, 'new-plan', { kind: 'user', userId: 'user-1' }, fingerprintOfOriginal)

      expect(result.ok).toBe(true)
      if (result.ok) {
        // sourceList.sourceFingerprint === fingerprintOfOriginal (matches new plan)
        // BUT updatedSourceBody fingerprint ≠ fingerprintOfOriginal → deprecated
        expect(result.value.copied).toBe(false)
      }
    })
  })

  describe('multiple matches → latest confirmedAt wins', () => {
    it('copies from the source with the highest confirmedAt when multiple plans match', async () => {
      const body = makeWeekPlanBody({
        '4': { breakfast: { recipeId: 'r4' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
      })
      const fingerprint = computeSourceFingerprint(body)
      const olderList: SavedConsolidatedShoppingListRecord = {
        lines: [{ id: 'L1', name: 'tomaten', quantity: 400, unit: 'g' }],
        sourceFingerprint: fingerprint,
        confirmedAt: '2026-05-20T08:00:00.000Z',
      }
      const newerList: SavedConsolidatedShoppingListRecord = {
        lines: [{ id: 'L1', name: 'tomaten', quantity: 600, unit: 'g' }],
        sourceFingerprint: fingerprint,
        confirmedAt: '2026-05-26T14:00:00.000Z',
      }
      const client = makeCopyClient({
        selectRows: [
          { id: 'plan-older', body, consolidated_shopping_list: olderList, owner_user_id: 'user-1', anon_session_id: null },
          { id: 'plan-newer', body, consolidated_shopping_list: newerList, owner_user_id: 'user-1', anon_session_id: null },
        ],
      })

      const result = await copyConsolidatedListFromMatchingPlan(client, 'new-plan', { kind: 'user', userId: 'user-1' }, fingerprint)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.copied).toBe(true)
        // Should use the newer list (higher confirmedAt)
        expect(result.value.copiedList?.confirmedAt).toBe('2026-05-26T14:00:00.000Z')
        expect(result.value.copiedList?.lines[0]?.quantity).toBe(600)
      }
    })
  })

  describe('different principal → no copy', () => {
    it('does not copy from plans owned by a different user (principal scoping is enforced by query)', async () => {
      // The SELECT query filters by principal — we verify this by returning empty rows
      // as the DB would when no plans match the principal filter.
      const body = makeWeekPlanBody({
        '1': { breakfast: { recipeId: 'r1' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
      })
      const fingerprint = computeSourceFingerprint(body)
      // DB returns no rows for user-2 even though user-1 has a matching plan
      const client = makeCopyClient({ selectRows: [] })

      const result = await copyConsolidatedListFromMatchingPlan(client, 'new-plan', { kind: 'user', userId: 'user-2' }, fingerprint)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.copied).toBe(false)
      }
    })

    it('anonymous principal does not receive copies scoped to other sessions', async () => {
      const body = makeWeekPlanBody()
      const fingerprint = computeSourceFingerprint(body)
      const client = makeCopyClient({ selectRows: [] })

      const result = await copyConsolidatedListFromMatchingPlan(client, 'new-plan', { kind: 'anonymous', sessionId: 'sess-other' }, fingerprint)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.copied).toBe(false)
      }
    })
  })

  describe('storage error handling', () => {
    it('returns storage_error when the SELECT query fails', async () => {
      const body = makeWeekPlanBody()
      const fingerprint = computeSourceFingerprint(body)
      const from = vi.fn().mockReturnValueOnce({
        select: () => makeFlexProxy({ data: null, error: { message: 'connection failed' } }),
      })
      const client = { from } as unknown as SupabaseClient

      const result = await copyConsolidatedListFromMatchingPlan(client, 'new-plan', { kind: 'user', userId: 'user-1' }, fingerprint)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.kind).toBe('storage_error')
      }
    })
  })
})

describe('PATCH saved-weekplan → copy-on-match is never triggered', () => {
  it('updateSavedWeekplan does not import or invoke copyConsolidatedListFromMatchingPlan', async () => {
    // Structural guard: verify updateSavedWeekplan module does not use copyConsolidatedListFromMatchingPlan.
    // This is verified by the absence of the function in the PATCH handler and savedWeekplansRepository.
    const { updateSavedWeekplan } = await import('../../server/services/planning/savedWeekplansRepository')
    const fnSource = updateSavedWeekplan.toString()
    expect(fnSource).not.toContain('copyConsolidatedListFromMatchingPlan')
  })
})
