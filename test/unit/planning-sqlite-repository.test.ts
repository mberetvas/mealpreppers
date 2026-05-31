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
  countAnonymousSavedWeekplansForSession,
  createSavedWeekplan,
  deleteSavedWeekplan,
  discardAnonymousSavedWeekplansForSession,
  getSavedWeekplanById,
  listSavedWeekplans,
  mergeAnonymousSavedWeekplansToUser,
  purgeAnonymousIdleSavedWeekplans,
  updateSavedWeekplan,
} from '../../server/services/planning/savedWeekplansRepository'
import { anonymousSavedWeekplanIdleCutoffIso } from '../../server/services/planning/anonymousSavedWeekplansIdlePurge'
import { computeSourceFingerprint } from '../../server/services/shopping-list/sourceFingerprint'

const ctx = useAppTestDb()

describe('Saved Weekplans (SQLite)', () => {
  const body = emptyWeekPlan()

  it('lists only rows owned by the user principal', async () => {
    await createSavedWeekplan(ctx.db, { kind: 'user', userId: 'user-1' }, { name: 'Mine', body })
    await createSavedWeekplan(ctx.db, { kind: 'user', userId: 'user-2' }, { name: 'Theirs', body })

    const result = await listSavedWeekplans(ctx.db, { kind: 'user', userId: 'user-1' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveLength(1)
      expect(result.value[0]?.name).toBe('Mine')
    }
  })

  it('lists only rows owned by the anonymous principal', async () => {
    await createSavedWeekplan(ctx.db, { kind: 'anonymous', sessionId: 'sess-a' }, { name: 'Anon A', body })
    await createSavedWeekplan(ctx.db, { kind: 'anonymous', sessionId: 'sess-b' }, { name: 'Anon B', body })

    const result = await listSavedWeekplans(ctx.db, { kind: 'anonymous', sessionId: 'sess-a' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveLength(1)
      expect(result.value[0]?.name).toBe('Anon A')
    }
  })

  it('sets owner_user_id on create for user principal', async () => {
    const result = await createSavedWeekplan(ctx.db, { kind: 'user', userId: 'user-1' }, { name: 'User week', body })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const row = ctx.db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, result.value.id)).get()
    expect(row?.ownerUserId).toBe('user-1')
    expect(row?.anonSessionId).toBeNull()
  })

  it('sets anon_session_id on create for anonymous principal', async () => {
    const result = await createSavedWeekplan(ctx.db, { kind: 'anonymous', sessionId: 'sess-1' }, { name: 'Anon week', body })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const row = ctx.db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, result.value.id)).get()
    expect(row?.ownerUserId).toBeNull()
    expect(row?.anonSessionId).toBe('sess-1')
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

  it('returns forbidden for cross-owner anonymous row', async () => {
    const created = await createSavedWeekplan(
      ctx.db,
      { kind: 'anonymous', sessionId: 'their-session' },
      { name: 'Other', body },
    )
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const result = await getSavedWeekplanById(
      ctx.db,
      created.value.id,
      { kind: 'anonymous', sessionId: 'my-session' },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('forbidden')
  })

  it('delete scopes to the owning user principal', async () => {
    const created = await createSavedWeekplan(ctx.db, { kind: 'user', userId: 'user-1' }, { name: 'Mine', body })
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
    const created = await createSavedWeekplan(ctx.db, { kind: 'user', userId: 'user-1' }, { name: 'Flags', body })
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

  it('update returns forbidden for cross-owner anonymous session', async () => {
    const created = await createSavedWeekplan(
      ctx.db,
      { kind: 'anonymous', sessionId: 'their-session' },
      { name: 'Other', body },
    )
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const result = await updateSavedWeekplan(
      ctx.db,
      created.value.id,
      { kind: 'anonymous', sessionId: 'my-session' },
      { name: 'Renamed' },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('forbidden')
  })
})

describe('anonymous Saved Weekplan handoff (SQLite)', () => {
  const body = emptyWeekPlan()

  it('counts anonymous-session rows', async () => {
    await createSavedWeekplan(ctx.db, { kind: 'anonymous', sessionId: 'sess-a' }, { name: 'One', body })
    await createSavedWeekplan(ctx.db, { kind: 'anonymous', sessionId: 'sess-a' }, { name: 'Two', body })
    await createSavedWeekplan(ctx.db, { kind: 'anonymous', sessionId: 'sess-b' }, { name: 'Other', body })

    const result = await countAnonymousSavedWeekplansForSession(ctx.db, 'sess-a')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe(2)
  })

  it('merges anonymous rows to authenticated user', async () => {
    await createSavedWeekplan(ctx.db, { kind: 'anonymous', sessionId: 'sess-a' }, { name: 'One', body })
    const result = await mergeAnonymousSavedWeekplansToUser(ctx.db, 'sess-a', 'user-1')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.moved).toBe(1)

    const row = ctx.db.select().from(mealWeekTemplates).all().find(r => r.name === 'One')
    expect(row?.ownerUserId).toBe('user-1')
    expect(row?.anonSessionId).toBeNull()
  })

  it('discards anonymous-session rows', async () => {
    await createSavedWeekplan(ctx.db, { kind: 'anonymous', sessionId: 'sess-x' }, { name: 'Discard me', body })
    const result = await discardAnonymousSavedWeekplansForSession(ctx.db, 'sess-x')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.deleted).toBe(1)
  })
})

describe('purgeAnonymousIdleSavedWeekplans (SQLite)', () => {
  const body = emptyWeekPlan()

  it('deletes only stale anonymous-owned rows', async () => {
    const fixedNow = new Date('2026-03-01T00:00:00.000Z')
    const cutoff = anonymousSavedWeekplanIdleCutoffIso(fixedNow)
    const staleUpdatedAt = new Date(new Date(cutoff).getTime() - 86_400_000).toISOString()
    const freshUpdatedAt = fixedNow.toISOString()

    const insert = (id: string, fields: {
      ownerUserId: string | null
      anonSessionId: string | null
      updatedAt: string
    }) => {
      ctx.db.insert(mealWeekTemplates).values({
        id,
        name: id,
        body,
        createdAt: fields.updatedAt,
        updatedAt: fields.updatedAt,
        ownerUserId: fields.ownerUserId,
        anonSessionId: fields.anonSessionId,
        consolidatedShoppingList: null,
      }).run()
    }

    insert('stale-anon', { ownerUserId: null, anonSessionId: 'sess-1', updatedAt: staleUpdatedAt })
    insert('fresh-anon', { ownerUserId: null, anonSessionId: 'sess-2', updatedAt: freshUpdatedAt })
    insert('user-owned', { ownerUserId: 'user-1', anonSessionId: null, updatedAt: staleUpdatedAt })
    insert('legacy-unowned', { ownerUserId: null, anonSessionId: null, updatedAt: staleUpdatedAt })

    const result = await purgeAnonymousIdleSavedWeekplans(ctx.db, { now: fixedNow })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.deleted).toBe(1)

    expect(ctx.db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, 'stale-anon')).get()).toBeUndefined()
    expect(ctx.db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, 'fresh-anon')).get()).toBeDefined()
    expect(ctx.db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, 'user-owned')).get()).toBeDefined()
    expect(ctx.db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, 'legacy-unowned')).get()).toBeDefined()
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
