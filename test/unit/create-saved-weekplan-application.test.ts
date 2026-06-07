import { describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { emptyWeekPlan } from '../../utils/weekPlan'
import { useAppTestDb } from '../helpers/recipeCatalogTestDb'
import { mealWeekTemplates } from '../../server/db/schema/planning'
import { executeCreateSavedWeekplan } from '../../server/services/planning/application/createSavedWeekplan'
import { sqliteConsolidatedShoppingListCopyAdapter } from '../../server/services/shopping-list/infrastructure/sqliteConsolidatedShoppingListCopyAdapter'
import { computeSourceFingerprint } from '../../server/services/shopping-list/sourceFingerprint'
import type { SavedConsolidatedShoppingListRecord } from '../../server/services/shopping-list/consolidatedShoppingListRepository'
import type { ConsolidatedShoppingListCopyPort } from '../../server/services/planning/ports/consolidatedShoppingListCopyPort'
import { fail } from '../../server/services/planning/planningResult'

const ctx = useAppTestDb()
const principal = { kind: 'user' as const, userId: 'user-1' }

function insertSourcePlanWithList(id: string, body: ReturnType<typeof emptyWeekPlan>, list: SavedConsolidatedShoppingListRecord) {
  const now = new Date().toISOString()
  ctx.db.insert(mealWeekTemplates).values({
    id,
    name: id,
    body,
    createdAt: now,
    updatedAt: now,
    ownerUserId: principal.userId,
    anonSessionId: null,
    consolidatedShoppingList: list,
  }).run()
}

describe('executeCreateSavedWeekplan', () => {
  it('creates a plan and copies a matching list atomically', () => {
    const body = emptyWeekPlan()
    const fingerprint = computeSourceFingerprint(body)
    insertSourcePlanWithList('source', body, {
      lines: [{ id: 'L1', name: 'melk', quantity: 1, unit: 'l' }],
      sourceFingerprint: fingerprint,
      confirmedAt: '2026-05-26T10:00:00.000Z',
    })

    const result = executeCreateSavedWeekplan(
      { db: ctx.db, copyPort: sqliteConsolidatedShoppingListCopyAdapter },
      principal,
      { name: 'New week', body },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.shoppingListCopiedFromMatch).toBe(true)

    const row = ctx.db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, result.value.id)).get()
    expect(row?.consolidatedShoppingList?.lines).toEqual([{ id: 'L1', name: 'melk', quantity: 1, unit: 'l' }])
  })

  it('returns shoppingListCopiedFromMatch false when no match exists', () => {
    const body = emptyWeekPlan()
    const result = executeCreateSavedWeekplan(
      { db: ctx.db, copyPort: sqliteConsolidatedShoppingListCopyAdapter },
      principal,
      { name: 'Solo week', body },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.shoppingListCopiedFromMatch).toBe(false)
    const row = ctx.db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, result.value.id)).get()
    expect(row?.consolidatedShoppingList).toBeNull()
  })

  it('still creates the plan when copy port fails (non-fatal copy-on-match)', () => {
    const body = emptyWeekPlan()
    const failingCopyPort: ConsolidatedShoppingListCopyPort = {
      copyFromMatchingPlan: vi.fn(() => fail({
        kind: 'storage_error',
        message: 'copy blew up',
      })),
    }

    const beforeCount = ctx.db.select({ id: mealWeekTemplates.id }).from(mealWeekTemplates).all().length
    const result = executeCreateSavedWeekplan(
      { db: ctx.db, copyPort: failingCopyPort },
      principal,
      { name: 'Copy failed but plan saved', body },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.shoppingListCopiedFromMatch).toBe(false)
    const afterCount = ctx.db.select({ id: mealWeekTemplates.id }).from(mealWeekTemplates).all().length
    expect(afterCount).toBe(beforeCount + 1)
    const row = ctx.db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, result.value.id)).get()
    expect(row?.name).toBe('Copy failed but plan saved')
    expect(row?.consolidatedShoppingList).toBeNull()
  })
})
