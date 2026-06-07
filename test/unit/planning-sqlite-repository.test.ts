import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { emptyWeekPlan } from '../../utils/weekPlan'
import { useAppTestDb } from '../helpers/recipeCatalogTestDb'
import { mealWeekTemplates } from '../../server/db/schema/planning'
import { recipes } from '../../server/db/schema/recipeCatalog'
import {
  assertRecipeIdsExist,
  createMonthPlan,
  deleteMonthPlan,
  getMonthPlanById,
  listMonthPlans,
  updateMonthPlan,
} from '../../server/services/planning/planningRepository'
import {
  deleteSavedWeekplan,
  getSavedWeekplanById,
  insertSavedWeekplanRow,
  listSavedWeekplans,
  updateSavedWeekplan,
} from '../../server/services/planning/savedWeekplansRepository'
import { computeSourceFingerprint } from '../../server/services/shopping-list/sourceFingerprint'

const ctx = useAppTestDb()

describe('Saved Weekplans (SQLite)', () => {
  const body = emptyWeekPlan()

  it('lists only rows owned by the user principal', async () => {
    await insertSavedWeekplanRow(ctx.db, { kind: 'user', userId: 'user-1' }, { name: 'Mine', body })
    await insertSavedWeekplanRow(ctx.db, { kind: 'user', userId: 'user-2' }, { name: 'Theirs', body })

    const result = await listSavedWeekplans(ctx.db, { kind: 'user', userId: 'user-1' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveLength(1)
      expect(result.value[0]?.name).toBe('Mine')
    }
  })

  it('sets owner_user_id on create for user principal', async () => {
    const result = await insertSavedWeekplanRow(ctx.db, { kind: 'user', userId: 'user-1' }, { name: 'User week', body })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const row = ctx.db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, result.value.id)).get()
    expect(row?.ownerUserId).toBe('user-1')
    expect(row?.anonSessionId).toBeNull()
  })

  it('returns not_found for legacy unowned rows', async () => {
    const legacyId = '00000000-0000-4000-8000-000000000099'
    const now = new Date().toISOString()
    ctx.db.insert(mealWeekTemplates).values({
      id: legacyId,
      name: 'Legacy',
      body,
      createdAt: now,
      updatedAt: now,
      ownerUserId: null,
      anonSessionId: null,
      consolidatedShoppingList: null,
    }).run()

    const result = await getSavedWeekplanById(ctx.db, legacyId, { kind: 'user', userId: 'user-1' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('not_found')
      expect(result.error.entity).toBe('saved_weekplan')
    }
  })

  it('returns forbidden for cross-owner user row', async () => {
    const created = await insertSavedWeekplanRow(
      ctx.db,
      { kind: 'user', userId: 'user-owner' },
      { name: 'Other', body },
    )
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const result = await getSavedWeekplanById(
      ctx.db,
      created.value.id,
      { kind: 'user', userId: 'user-intruder' },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('forbidden')
  })

  it('delete scopes to the owning user principal', async () => {
    const created = await insertSavedWeekplanRow(ctx.db, { kind: 'user', userId: 'user-1' }, { name: 'Mine', body })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const wrongPrincipal = await deleteSavedWeekplan(
      ctx.db,
      created.value.id,
      { kind: 'user', userId: 'user-2' },
    )
    expect(wrongPrincipal.ok).toBe(false)

    const ok = await deleteSavedWeekplan(ctx.db, created.value.id, { kind: 'user', userId: 'user-1' })
    expect(ok.ok).toBe(true)
  })

  it('returns shopping list flags on list rows', async () => {
    const fingerprint = computeSourceFingerprint(body)
    const created = await insertSavedWeekplanRow(ctx.db, { kind: 'user', userId: 'user-1' }, { name: 'Flags', body })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    ctx.db.update(mealWeekTemplates).set({
      consolidatedShoppingList: {
        lines: [],
        sourceFingerprint: fingerprint,
        confirmedAt: '2026-01-01T00:00:00.000Z',
      },
    }).where(eq(mealWeekTemplates.id, created.value.id)).run()

    const result = await listSavedWeekplans(ctx.db, { kind: 'user', userId: 'user-1' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value[0]?.hasSavedShoppingList).toBe(true)
      expect(result.value[0]?.shoppingListDeprecated).toBe(false)
    }
  })

  it('update returns forbidden for cross-owner user', async () => {
    const created = await insertSavedWeekplanRow(
      ctx.db,
      { kind: 'user', userId: 'user-owner' },
      { name: 'Other', body },
    )
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const result = await updateSavedWeekplan(
      ctx.db,
      created.value.id,
      { kind: 'user', userId: 'user-intruder' },
      { name: 'Renamed' },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('forbidden')
  })
})

describe('Month plans (SQLite)', () => {
  const monthBody = { version: 'month_v1' as const, weeks: [null, null, null, null] }

  it('creates and lists month plans', async () => {
    const created = await createMonthPlan(ctx.db, { name: 'June', body: monthBody })
    expect(created.ok).toBe(true)

    const listed = await listMonthPlans(ctx.db)
    expect(listed.ok).toBe(true)
    if (listed.ok) {
      expect(listed.value.some(row => row.name === 'June')).toBe(true)
    }
  })

  it('gets, updates, and deletes a month plan', async () => {
    const created = await createMonthPlan(ctx.db, { name: 'July', body: monthBody })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const fetched = await getMonthPlanById(ctx.db, created.value.id)
    expect(fetched.ok).toBe(true)

    const updated = await updateMonthPlan(ctx.db, created.value.id, { name: 'July revised' })
    expect(updated.ok).toBe(true)
    if (updated.ok) expect(updated.value.name).toBe('July revised')

    const deleted = await deleteMonthPlan(ctx.db, created.value.id)
    expect(deleted.ok).toBe(true)

    const missing = await getMonthPlanById(ctx.db, created.value.id)
    expect(missing.ok).toBe(false)
  })
})

describe('assertRecipeIdsExist (SQLite)', () => {
  it('returns invalid_recipe_ids when a recipe id is missing', async () => {
    const result = await assertRecipeIdsExist(ctx.db, ['missing-recipe-id'])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('invalid_recipe_ids')
  })

  it('passes when all recipe ids exist', async () => {
    const now = new Date().toISOString()
    ctx.db.insert(recipes).values({
      id: 'recipe-1',
      title: 'Test',
      categories: [],
      tags: [],
      createdAt: now,
      updatedAt: now,
    }).run()

    const result = await assertRecipeIdsExist(ctx.db, ['recipe-1'])
    expect(result.ok).toBe(true)
  })
})
