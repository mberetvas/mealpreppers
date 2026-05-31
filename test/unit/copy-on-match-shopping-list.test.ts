/**
 * Tests for Copy-on-match on POST saved-weekplan create (issue #0005).
 */
import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  copyConsolidatedListFromMatchingPlan,
  type SavedConsolidatedShoppingListRecord,
} from '../../server/services/shopping-list/consolidatedShoppingListRepository'
import { computeSourceFingerprint } from '../../server/services/shopping-list/sourceFingerprint'
import type { WeekPlanV1 } from '../../types/planning'
import { useAppTestDb } from '../helpers/recipeCatalogTestDb'
import { mealWeekTemplates } from '../../server/db/schema/planning'

const ctx = useAppTestDb()

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

function insertWeekPlan(fields: {
  id: string
  body: WeekPlanV1
  ownerUserId: string | null
  anonSessionId: string | null
  consolidatedShoppingList: SavedConsolidatedShoppingListRecord | null
}) {
  const now = new Date().toISOString()
  ctx.db.insert(mealWeekTemplates).values({
    id: fields.id,
    name: fields.id,
    body: fields.body,
    createdAt: now,
    updatedAt: now,
    ownerUserId: fields.ownerUserId,
    anonSessionId: fields.anonSessionId,
    consolidatedShoppingList: fields.consolidatedShoppingList,
  }).run()
}

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
      insertWeekPlan({
        id: 'source-plan',
        body,
        ownerUserId: 'user-1',
        anonSessionId: null,
        consolidatedShoppingList: sourceList,
      })
      insertWeekPlan({
        id: 'new-plan',
        body,
        ownerUserId: 'user-1',
        anonSessionId: null,
        consolidatedShoppingList: null,
      })

      const result = await copyConsolidatedListFromMatchingPlan(ctx.db, 'new-plan', { kind: 'user', userId: 'user-1' }, fingerprint)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.copied).toBe(true)
        expect(result.value.copiedList).toEqual(sourceList)
      }
    })

    it('writes the copied list to the new plan row', async () => {
      const body = makeWeekPlanBody({
        '2': { breakfast: { recipeId: 'r2' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
      })
      const fingerprint = computeSourceFingerprint(body)
      const sourceList: SavedConsolidatedShoppingListRecord = {
        lines: [{ id: 'L1', name: 'melk', quantity: 1, unit: 'l' }],
        sourceFingerprint: fingerprint,
        confirmedAt: '2026-05-25T08:00:00.000Z',
      }
      insertWeekPlan({
        id: 'source-plan-2',
        body,
        ownerUserId: 'user-1',
        anonSessionId: null,
        consolidatedShoppingList: sourceList,
      })
      insertWeekPlan({
        id: 'new-plan-2',
        body,
        ownerUserId: 'user-1',
        anonSessionId: null,
        consolidatedShoppingList: null,
      })

      await copyConsolidatedListFromMatchingPlan(ctx.db, 'new-plan-2', { kind: 'user', userId: 'user-1' }, fingerprint)

      const row = ctx.db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, 'new-plan-2')).get()
      expect(row?.consolidatedShoppingList).toEqual(sourceList)
    })
  })

  describe('no match → no copy', () => {
    it('returns { copied: false } when no plans exist for the principal', async () => {
      const body = makeWeekPlanBody()
      const fingerprint = computeSourceFingerprint(body)
      insertWeekPlan({
        id: 'new-plan-only',
        body,
        ownerUserId: 'user-1',
        anonSessionId: null,
        consolidatedShoppingList: null,
      })

      const result = await copyConsolidatedListFromMatchingPlan(ctx.db, 'new-plan-only', { kind: 'user', userId: 'user-1' }, fingerprint)

      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.copied).toBe(false)
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
      insertWeekPlan({
        id: 'source-mismatch',
        body: differentBody,
        ownerUserId: 'user-1',
        anonSessionId: null,
        consolidatedShoppingList: sourceList,
      })
      insertWeekPlan({
        id: 'new-mismatch',
        body,
        ownerUserId: 'user-1',
        anonSessionId: null,
        consolidatedShoppingList: null,
      })

      const result = await copyConsolidatedListFromMatchingPlan(ctx.db, 'new-mismatch', { kind: 'user', userId: 'user-1' }, fingerprintOfNew)

      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.copied).toBe(false)
    })
  })

  describe('deprecated source → no copy', () => {
    it('skips source when its consolidated list is deprecated relative to its own body', async () => {
      const originalSourceBody = makeWeekPlanBody({
        '1': { breakfast: { recipeId: 'r1' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
      })
      const fingerprintOfOriginal = computeSourceFingerprint(originalSourceBody)
      const updatedSourceBody = makeWeekPlanBody({
        '1': { breakfast: { recipeId: 'r1' }, lunch: { recipeId: 'r2' }, dinner: { recipeId: null } },
      })
      const sourceList: SavedConsolidatedShoppingListRecord = {
        lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
        sourceFingerprint: fingerprintOfOriginal,
        confirmedAt: '2026-05-26T10:00:00.000Z',
      }
      insertWeekPlan({
        id: 'source-deprecated',
        body: updatedSourceBody,
        ownerUserId: 'user-1',
        anonSessionId: null,
        consolidatedShoppingList: sourceList,
      })
      insertWeekPlan({
        id: 'new-deprecated',
        body: originalSourceBody,
        ownerUserId: 'user-1',
        anonSessionId: null,
        consolidatedShoppingList: null,
      })

      const result = await copyConsolidatedListFromMatchingPlan(ctx.db, 'new-deprecated', { kind: 'user', userId: 'user-1' }, fingerprintOfOriginal)

      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.copied).toBe(false)
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
      insertWeekPlan({
        id: 'plan-older',
        body,
        ownerUserId: 'user-1',
        anonSessionId: null,
        consolidatedShoppingList: olderList,
      })
      insertWeekPlan({
        id: 'plan-newer',
        body,
        ownerUserId: 'user-1',
        anonSessionId: null,
        consolidatedShoppingList: newerList,
      })
      insertWeekPlan({
        id: 'new-multi',
        body,
        ownerUserId: 'user-1',
        anonSessionId: null,
        consolidatedShoppingList: null,
      })

      const result = await copyConsolidatedListFromMatchingPlan(ctx.db, 'new-multi', { kind: 'user', userId: 'user-1' }, fingerprint)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.copied).toBe(true)
        expect(result.value.copiedList?.confirmedAt).toBe('2026-05-26T14:00:00.000Z')
        expect(result.value.copiedList?.lines[0]?.quantity).toBe(600)
      }
    })
  })

  describe('different principal → no copy', () => {
    it('does not copy from plans owned by a different user', async () => {
      const body = makeWeekPlanBody({
        '1': { breakfast: { recipeId: 'r1' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
      })
      const fingerprint = computeSourceFingerprint(body)
      const sourceList: SavedConsolidatedShoppingListRecord = {
        lines: [{ id: 'L1', name: 'pasta', quantity: 1, unit: 'kg' }],
        sourceFingerprint: fingerprint,
        confirmedAt: '2026-05-26T10:00:00.000Z',
      }
      insertWeekPlan({
        id: 'user-1-plan',
        body,
        ownerUserId: 'user-1',
        anonSessionId: null,
        consolidatedShoppingList: sourceList,
      })
      insertWeekPlan({
        id: 'user-2-new',
        body,
        ownerUserId: 'user-2',
        anonSessionId: null,
        consolidatedShoppingList: null,
      })

      const result = await copyConsolidatedListFromMatchingPlan(ctx.db, 'user-2-new', { kind: 'user', userId: 'user-2' }, fingerprint)

      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.copied).toBe(false)
    })

    it('local user does not receive copies scoped to other owners', async () => {
      const body = makeWeekPlanBody()
      const fingerprint = computeSourceFingerprint(body)
      const sourceList: SavedConsolidatedShoppingListRecord = {
        lines: [{ id: 'L1', name: 'ui', quantity: 1, unit: 'st' }],
        sourceFingerprint: fingerprint,
        confirmedAt: '2026-05-26T10:00:00.000Z',
      }
      insertWeekPlan({
        id: 'user-a-plan',
        body,
        ownerUserId: 'user-a',
        anonSessionId: null,
        consolidatedShoppingList: sourceList,
      })
      insertWeekPlan({
        id: 'user-b-new',
        body,
        ownerUserId: 'user-b',
        anonSessionId: null,
        consolidatedShoppingList: null,
      })

      const result = await copyConsolidatedListFromMatchingPlan(ctx.db, 'user-b-new', { kind: 'user', userId: 'user-b' }, fingerprint)

      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.copied).toBe(false)
    })
  })
})

describe('PATCH saved-weekplan → copy-on-match is never triggered', () => {
  it('updateSavedWeekplan does not import or invoke copyConsolidatedListFromMatchingPlan', async () => {
    const { updateSavedWeekplan } = await import('../../server/services/planning/savedWeekplansRepository')
    const fnSource = updateSavedWeekplan.toString()
    expect(fnSource).not.toContain('copyConsolidatedListFromMatchingPlan')
  })
})
