/**
 * Tests for Saved consolidated shopping list persistence (issue #029).
 * Covers: migration existence, repository round-trip, API GET/PUT,
 * plan GET embed (hasSavedShoppingList, shoppingListDeprecated),
 * and composable load + save flow.
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { eq } from 'drizzle-orm'
import type { MergedLine } from '../../server/services/shopping-list/exactMerge'
import {
  getConsolidatedShoppingList,
  saveConsolidatedShoppingList,
  computeShoppingListFlags,
  validateConsolidatedShoppingListInput,
  type SavedConsolidatedShoppingListRecord,
} from '../../server/services/shopping-list/consolidatedShoppingListRepository'
import { computeSourceFingerprint } from '../../server/services/shopping-list/sourceFingerprint'
import type { WeekPlanV1 } from '../../types/planning'
import { useAppTestDb } from '../helpers/recipeCatalogTestDb'
import { mealWeekTemplates } from '../../server/db/schema/planning'

const REPO_ROOT = resolve(__dirname, '../..')
const ctx = useAppTestDb()

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

// --- Migration existence test ---

describe('SQLite migration for consolidated_shopping_list column', () => {
  it('planning migration defines consolidated_shopping_list on meal_week_templates', () => {
    const migrationPath = resolve(REPO_ROOT, 'server/db/migrations/0001_planning.sql')
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('consolidated_shopping_list')
    expect(sql).toContain('meal_week_templates')
  })
})

// --- Repository tests ---

describe('consolidatedShoppingListRepository', () => {
  describe('getConsolidatedShoppingList', () => {
    it('returns null when no saved list exists (column is null)', async () => {
      insertWeekPlan({
        id: 'plan-1',
        body: makeWeekPlanBody(),
        ownerUserId: 'sess-1',
        anonSessionId: null,
        consolidatedShoppingList: null,
      })

      const result = await getConsolidatedShoppingList(ctx.db, 'plan-1', { kind: 'user', userId: 'sess-1' })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBeNull()
      }
    })

    it('returns the saved record when present', async () => {
      const lines = makeSavedLines()
      const body = makeWeekPlanBody({ '1': { breakfast: { recipeId: 'r1' }, lunch: { recipeId: null }, dinner: { recipeId: null } } })
      const fingerprint = computeSourceFingerprint(body)
      const record: SavedConsolidatedShoppingListRecord = {
        lines,
        sourceFingerprint: fingerprint,
        confirmedAt: '2026-05-26T10:00:00.000Z',
      }
      insertWeekPlan({
        id: 'plan-1',
        body,
        ownerUserId: 'user-1',
        anonSessionId: null,
        consolidatedShoppingList: record,
      })

      const result = await getConsolidatedShoppingList(ctx.db, 'plan-1', { kind: 'user', userId: 'user-1' })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).not.toBeNull()
        expect(result.value!.lines).toHaveLength(2)
        expect(result.value!.sourceFingerprint).toBe(fingerprint)
        expect(result.value!.confirmedAt).toBe('2026-05-26T10:00:00.000Z')
      }
    })

    it('returns lines in stored order without re-sorting', async () => {
      const body = makeWeekPlanBody()
      const fingerprint = computeSourceFingerprint(body)
      const record: SavedConsolidatedShoppingListRecord = {
        lines: [
          { id: 'L1', name: 'melk', quantity: 1, unit: 'l', aisleCategory: 'dairy' },
          { id: 'L2', name: 'pasta', quantity: 800, unit: 'g', aisleCategory: 'dry_goods' },
          { id: 'L3', name: 'tomaten', quantity: 400, unit: 'g', aisleCategory: 'produce' },
        ],
        sourceFingerprint: fingerprint,
        confirmedAt: '2026-05-26T10:00:00.000Z',
      }
      insertWeekPlan({
        id: 'plan-1',
        body,
        ownerUserId: 'user-1',
        anonSessionId: null,
        consolidatedShoppingList: record,
      })

      const result = await getConsolidatedShoppingList(ctx.db, 'plan-1', { kind: 'user', userId: 'user-1' })

      expect(result.ok).toBe(true)
      if (result.ok && result.value) {
        expect(result.value.lines.map(l => l.name)).toEqual(['melk', 'pasta', 'tomaten'])
        expect(result.value.lines[0].aisleCategory).toBe('dairy')
      }
    })

    it('returns not_found for non-existent plan', async () => {
      const result = await getConsolidatedShoppingList(ctx.db, 'non-existent', { kind: 'user', userId: 'sess-1' })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.kind).toBe('not_found')
      }
    })

    it('returns forbidden for wrong owner', async () => {
      insertWeekPlan({
        id: 'plan-1',
        body: makeWeekPlanBody(),
        ownerUserId: 'other-user',
        anonSessionId: null,
        consolidatedShoppingList: null,
      })

      const result = await getConsolidatedShoppingList(ctx.db, 'plan-1', { kind: 'user', userId: 'user-1' })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.kind).toBe('forbidden')
      }
    })
  })

  describe('saveConsolidatedShoppingList', () => {
    it('stores lines and server-computed sourceFingerprint', async () => {
      const body = makeWeekPlanBody({ '1': { breakfast: { recipeId: 'r1' }, lunch: { recipeId: null }, dinner: { recipeId: null } } })
      const lines = makeSavedLines()
      const expectedFingerprint = computeSourceFingerprint(body)

      insertWeekPlan({
        id: 'plan-1',
        body,
        ownerUserId: 'sess-1',
        anonSessionId: null,
        consolidatedShoppingList: null,
      })

      const result = await saveConsolidatedShoppingList(ctx.db, 'plan-1', { kind: 'user', userId: 'sess-1' }, lines)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.sourceFingerprint).toBe(expectedFingerprint)
        expect(result.value.lines).toEqual(lines)
        expect(result.value.confirmedAt).toBeDefined()
      }

      const row = ctx.db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, 'plan-1')).get()
      expect(row?.consolidatedShoppingList?.sourceFingerprint).toBe(expectedFingerprint)
    })

    it('persists lines in input order with aisleCategory', async () => {
      const body = makeWeekPlanBody()
      const lines = [
        { id: 'L1', name: 'melk', quantity: 1, unit: 'l', aisleCategory: 'dairy' as const },
        { id: 'L2', name: 'pasta', quantity: 800, unit: 'g', aisleCategory: 'dry_goods' as const },
        { id: 'L3', name: 'tomaten', quantity: 400, unit: 'g', aisleCategory: 'produce' as const },
      ]
      insertWeekPlan({
        id: 'plan-1',
        body,
        ownerUserId: 'sess-1',
        anonSessionId: null,
        consolidatedShoppingList: null,
      })

      const result = await saveConsolidatedShoppingList(ctx.db, 'plan-1', { kind: 'user', userId: 'sess-1' }, lines)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.lines).toEqual(lines)
      }
      const row = ctx.db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, 'plan-1')).get()
      expect(row?.consolidatedShoppingList?.lines).toEqual(lines)
    })

    it('rejects save for wrong owner', async () => {
      insertWeekPlan({
        id: 'plan-1',
        body: makeWeekPlanBody(),
        ownerUserId: 'other-user',
        anonSessionId: null,
        consolidatedShoppingList: null,
      })

      const result = await saveConsolidatedShoppingList(ctx.db, 'plan-1', { kind: 'user', userId: 'me' }, makeSavedLines())

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.kind).toBe('forbidden')
      }
    })

    it('rejects save for non-existent plan', async () => {
      const result = await saveConsolidatedShoppingList(ctx.db, 'non-existent', { kind: 'user', userId: 'sess-1' }, makeSavedLines())

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.kind).toBe('not_found')
      }
    })

    it('local owner can save their own plan', async () => {
      const body = makeWeekPlanBody()
      insertWeekPlan({
        id: 'plan-1',
        body,
        ownerUserId: 'sess-1',
        anonSessionId: null,
        consolidatedShoppingList: null,
      })

      const result = await saveConsolidatedShoppingList(ctx.db, 'plan-1', { kind: 'user', userId: 'sess-1' }, makeSavedLines())

      expect(result.ok).toBe(true)
    })

    it('authenticated owner can save their own plan', async () => {
      const body = makeWeekPlanBody()
      insertWeekPlan({
        id: 'plan-1',
        body,
        ownerUserId: 'user-1',
        anonSessionId: null,
        consolidatedShoppingList: null,
      })

      const result = await saveConsolidatedShoppingList(ctx.db, 'plan-1', { kind: 'user', userId: 'user-1' }, makeSavedLines())

      expect(result.ok).toBe(true)
    })
  })
})

// --- Plan GET embed tests ---

describe('Saved Weekplan GET embed flags', () => {
  it('hasSavedShoppingList is true when consolidated_shopping_list is not null', () => {
    const body = makeWeekPlanBody()
    const record: SavedConsolidatedShoppingListRecord = {
      lines: makeSavedLines(),
      sourceFingerprint: computeSourceFingerprint(body),
      confirmedAt: '2026-05-26T10:00:00.000Z',
    }

    const flags = computeShoppingListFlags(record, body)

    expect(flags.hasSavedShoppingList).toBe(true)
    expect(flags.shoppingListDeprecated).toBe(false)
  })

  it('hasSavedShoppingList is false when consolidated_shopping_list is null', () => {
    const body = makeWeekPlanBody()

    const flags = computeShoppingListFlags(null, body)

    expect(flags.hasSavedShoppingList).toBe(false)
    expect(flags.shoppingListDeprecated).toBe(false)
  })

  it('shoppingListDeprecated is true when stored fingerprint ≠ current body hash', () => {
    const originalBody = makeWeekPlanBody()
    const record: SavedConsolidatedShoppingListRecord = {
      lines: makeSavedLines(),
      sourceFingerprint: computeSourceFingerprint(originalBody),
      confirmedAt: '2026-05-26T10:00:00.000Z',
    }
    const changedBody = makeWeekPlanBody({ '1': { breakfast: { recipeId: 'new-recipe' }, lunch: { recipeId: null }, dinner: { recipeId: null } } })

    const flags = computeShoppingListFlags(record, changedBody)

    expect(flags.hasSavedShoppingList).toBe(true)
    expect(flags.shoppingListDeprecated).toBe(true)
  })
})

// --- API handler tests ---

describe('PUT /api/v1/saved-weekplans/:id/consolidated-shopping-list', () => {
  it('validates that lines array is provided', async () => {
    const result = validateConsolidatedShoppingListInput({ lines: null })
    expect(result.valid).toBe(false)
  })

  it('validates line shape: id, name, quantity, unit required', async () => {
    const result = validateConsolidatedShoppingListInput({
      lines: [{ id: 'L1', name: 'pasta' }], // missing quantity and unit
    })
    expect(result.valid).toBe(true) // quantity and unit can be undefined
  })

  it('rejects lines with missing name', () => {
    const result = validateConsolidatedShoppingListInput({
      lines: [{ id: 'L1', quantity: 400, unit: 'g' }], // missing name
    })
    expect(result.valid).toBe(false)
  })

  it('rejects lines with missing id', () => {
    const result = validateConsolidatedShoppingListInput({
      lines: [{ name: 'pasta', quantity: 400, unit: 'g' }], // missing id
    })
    expect(result.valid).toBe(false)
  })

  it('accepts valid lines with all fields', () => {
    const result = validateConsolidatedShoppingListInput({
      lines: [
        { id: 'L1', name: 'pasta', quantity: 800, unit: 'g' },
        { id: 'L2', name: 'olijfolie', quantity: 2, unit: 'el' },
      ],
    })
    expect(result.valid).toBe(true)
  })

  it('client never sends fingerprint — server ignores it', () => {
    const result = validateConsolidatedShoppingListInput({
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
      sourceFingerprint: 'should-be-ignored',
    })
    expect(result.valid).toBe(true)
    // The sourceFingerprint from client should be stripped
    expect(result.lines![0].name).toBe('pasta')
  })
})

// --- Composable load + save flow tests ---

describe('useConsolidatedShoppingList — load + save flow', () => {
  it('loadSavedList shows saved list without running Consolidate action', async () => {
    const { ref } = await import('vue')
    const { useConsolidatedShoppingList } = await import('../../app/composables/useConsolidatedShoppingList')

    const planId = ref('plan-1')
    const savedRecord: SavedConsolidatedShoppingListRecord = {
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
      sourceFingerprint: 'abc123',
      confirmedAt: '2026-05-26T10:00:00.000Z',
    }
    const fetchConsolidate = vi.fn()
    const fetchSavedList = vi.fn().mockResolvedValue(savedRecord)
    const savelist = vi.fn()

    const { loadSavedList, consolidatedLines, baselineLines, polishStatus, hasConsolidated } =
      useConsolidatedShoppingList(planId, { fetchConsolidate, fetchSavedList, savelist })

    await loadSavedList()

    expect(fetchConsolidate).not.toHaveBeenCalled()
    expect(consolidatedLines.value).toHaveLength(1)
    expect(consolidatedLines.value[0].name).toBe('pasta')
    expect(baselineLines.value).toEqual(consolidatedLines.value)
    expect(polishStatus.value).toBe('polished')
    expect(hasConsolidated.value).toBe(true)
  })

  it('confirmReview persists via PUT', async () => {
    const { ref } = await import('vue')
    const { useConsolidatedShoppingList } = await import('../../app/composables/useConsolidatedShoppingList')

    const planId = ref('plan-1')
    const fetchConsolidate = vi.fn().mockResolvedValue({
      consolidatedLines: [
        { id: 'L1', name: 'tomaten', quantity: 600, unit: 'g', provenance: [] },
      ],
      baselineLines: [
        { id: 'L1', name: 'tomaten', quantity: 400, unit: 'g', provenance: [] },
      ],
      changes: [],
      polishStatus: 'pending_review',
      warnings: [],
      hints: [],
    })
    const savedRecord: SavedConsolidatedShoppingListRecord = {
      lines: [{ id: 'L1', name: 'tomaten', quantity: 600, unit: 'g' }],
      sourceFingerprint: 'computed-by-server',
      confirmedAt: '2026-05-26T12:00:00.000Z',
    }
    const savelist = vi.fn().mockResolvedValue(savedRecord)

    const { consolidate, confirmReview, savedList, polishStatus } =
      useConsolidatedShoppingList(planId, { fetchConsolidate, savelist })

    await consolidate()
    expect(polishStatus.value).toBe('pending_review')

    await confirmReview()
    expect(polishStatus.value).toBe('polished')
    expect(savelist).toHaveBeenCalledWith('plan-1', [{ id: 'L1', name: 'tomaten', quantity: 600, unit: 'g', aisleCategory: 'produce' }])

    // Wait for the save promise
    await vi.waitFor(() => expect(savedList.value).not.toBeNull())
    expect(savedList.value!.sourceFingerprint).toBe('computed-by-server')
  })

  it('hydrates saved list when planId is set without an explicit loadSavedList call', async () => {
    const { ref } = await import('vue')
    const { useConsolidatedShoppingList } = await import('../../app/composables/useConsolidatedShoppingList')

    const planId = ref('plan-1')
    const savedRecord: SavedConsolidatedShoppingListRecord = {
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
      sourceFingerprint: 'abc123',
      confirmedAt: '2026-05-26T10:00:00.000Z',
    }
    const fetchSavedList = vi.fn().mockResolvedValue(savedRecord)
    const fetchPlanFlags = vi.fn().mockResolvedValue({
      hasSavedShoppingList: true,
      shoppingListDeprecated: false,
    })

    const { consolidatedLines, savedList, hasConsolidated } =
      useConsolidatedShoppingList(planId, { fetchSavedList, fetchPlanFlags })

    await vi.waitFor(() => expect(hasConsolidated.value).toBe(true))

    expect(fetchSavedList).toHaveBeenCalledWith('plan-1')
    expect(savedList.value).toEqual(savedRecord)
    expect(consolidatedLines.value[0]?.name).toBe('pasta')
  })

  it('loadSavedList does nothing when no saved list exists', async () => {
    const { ref } = await import('vue')
    const { useConsolidatedShoppingList } = await import('../../app/composables/useConsolidatedShoppingList')

    const planId = ref('plan-1')
    const fetchSavedList = vi.fn().mockResolvedValue(null)

    const { loadSavedList, consolidatedLines, hasConsolidated } =
      useConsolidatedShoppingList(planId, { fetchSavedList })

    await loadSavedList()

    expect(consolidatedLines.value).toHaveLength(0)
    expect(hasConsolidated.value).toBe(false)
  })
})
