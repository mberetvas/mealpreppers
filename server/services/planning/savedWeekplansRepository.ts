import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import type { WeekPlanV1, WeekTemplateCreateInput, WeekTemplatePatchInput } from '../../../types/planning'
import type { AppDb } from '../../db/sqlite'
import { mealWeekTemplates } from '../../db/schema/planning'
import type { PlanningPrincipal } from './planningPrincipal'
import { fail, ok, type PlanningResult } from './planningResult'
import { interpretSavedWeekplanAccess } from './savedWeekplanAccess'
import type { WeekTemplateListItem, WeekTemplateRow } from './planningRepository'
import { computeShoppingListFlags, type SavedConsolidatedShoppingListRecord } from '../shopping-list/consolidatedShoppingListRepository'

type WeekTemplateSelectRow = typeof mealWeekTemplates.$inferSelect

function nowIso(): string {
  return new Date().toISOString()
}

function ownerColumns(row: WeekTemplateSelectRow) {
  return {
    owner_user_id: row.ownerUserId,
    anon_session_id: row.anonSessionId,
  }
}

function mapWeekTemplateRow(row: WeekTemplateSelectRow): WeekTemplateRow {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function principalFilter(principal: PlanningPrincipal) {
  return eq(mealWeekTemplates.ownerUserId, principal.userId)
}

function ownerInsertPayload(principal: PlanningPrincipal): { ownerUserId: string, anonSessionId: null } {
  return { ownerUserId: principal.userId, anonSessionId: null }
}

function storageError(message: string | undefined, fallback: string) {
  return {
    kind: 'storage_error' as const,
    message: message ?? fallback,
  }
}

function savedNotFound() {
  return {
    kind: 'not_found' as const,
    entity: 'saved_weekplan' as const,
    message: 'Saved weekplan not found.',
  }
}

function savedForbidden() {
  return {
    kind: 'forbidden' as const,
    entity: 'saved_weekplan' as const,
    message: 'You do not have access to this saved weekplan.',
  }
}

function interpretRowAccess(row: WeekTemplateSelectRow, principal: PlanningPrincipal) {
  return interpretSavedWeekplanAccess(ownerColumns(row), principal)
}

/** Lists saved weekplans visible to the current principal (excludes legacy unowned rows). Each row includes shopping list status flags. */
export async function listSavedWeekplans(
  db: AppDb,
  principal: PlanningPrincipal,
): Promise<PlanningResult<WeekTemplateListItemWithShoppingListFlags[]>> {
  try {
    const rows = db
      .select({
        id: mealWeekTemplates.id,
        name: mealWeekTemplates.name,
        updatedAt: mealWeekTemplates.updatedAt,
        body: mealWeekTemplates.body,
        consolidatedShoppingList: mealWeekTemplates.consolidatedShoppingList,
      })
      .from(mealWeekTemplates)
      .where(principalFilter(principal))
      .orderBy(desc(mealWeekTemplates.updatedAt))
      .all()

    return ok(rows.map(row => ({
      id: row.id,
      name: row.name,
      updatedAt: row.updatedAt,
      ...computeShoppingListFlags(
        row.consolidatedShoppingList as SavedConsolidatedShoppingListRecord | null,
        row.body,
      ),
    })))
  }
  catch (error) {
    return fail(storageError(error instanceof Error ? error.message : undefined, 'Saved weekplans could not be loaded.'))
  }
}

/** Fetches one saved weekplan by id when owned by the principal. */
export async function getSavedWeekplanById(
  db: AppDb,
  id: string,
  principal: PlanningPrincipal,
): Promise<PlanningResult<WeekTemplateRow>> {
  try {
    const row = db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, id)).get()

    if (!row) {
      return fail(savedNotFound())
    }

    const access = interpretRowAccess(row, principal)
    if (access === 'legacy_unowned') {
      return fail(savedNotFound())
    }
    if (access === 'wrong_owner') {
      return fail(savedForbidden())
    }

    return ok(mapWeekTemplateRow(row))
  }
  catch (error) {
    return fail(storageError(error instanceof Error ? error.message : undefined, 'Saved weekplan could not be loaded.'))
  }
}

/** List-row shape returned by `listSavedWeekplans`, includes shopping list status flags. */
export interface WeekTemplateListItemWithShoppingListFlags extends WeekTemplateListItem {
  hasSavedShoppingList: boolean
  shoppingListDeprecated: boolean
}

export interface WeekTemplateRowWithShoppingListFlags extends WeekTemplateRow {
  hasSavedShoppingList: boolean
  shoppingListDeprecated: boolean
}

/** Fetches one saved weekplan by id with embedded shopping list flags. */
export async function getSavedWeekplanWithShoppingListFlags(
  db: AppDb,
  id: string,
  principal: PlanningPrincipal,
): Promise<PlanningResult<WeekTemplateRowWithShoppingListFlags>> {
  try {
    const row = db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, id)).get()

    if (!row) {
      return fail(savedNotFound())
    }

    const access = interpretRowAccess(row, principal)
    if (access === 'legacy_unowned') {
      return fail(savedNotFound())
    }
    if (access === 'wrong_owner') {
      return fail(savedForbidden())
    }

    const flags = computeShoppingListFlags(
      row.consolidatedShoppingList as SavedConsolidatedShoppingListRecord | null,
      row.body,
    )
    return ok({ ...mapWeekTemplateRow(row), ...flags })
  }
  catch (error) {
    return fail(storageError(error instanceof Error ? error.message : undefined, 'Saved weekplan could not be loaded.'))
  }
}

/** Creates a saved weekplan row owned by the current principal. */
export async function createSavedWeekplan(
  db: AppDb,
  principal: PlanningPrincipal,
  input: WeekTemplateCreateInput,
): Promise<PlanningResult<WeekTemplateRow>> {
  try {
    const owners = ownerInsertPayload(principal)
    const timestamp = nowIso()
    const id = randomUUID()

    db.insert(mealWeekTemplates).values({
      id,
      name: input.name,
      body: input.body,
      ...owners,
      createdAt: timestamp,
      updatedAt: timestamp,
      consolidatedShoppingList: null,
    }).run()

    const row = db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, id)).get()
    if (!row) {
      return fail(storageError(undefined, 'Saved weekplan could not be created.'))
    }

    return ok(mapWeekTemplateRow(row))
  }
  catch (error) {
    return fail(storageError(error instanceof Error ? error.message : undefined, 'Saved weekplan could not be created.'))
  }
}

/** Updates a saved weekplan when owned by the principal. */
export async function updateSavedWeekplan(
  db: AppDb,
  id: string,
  principal: PlanningPrincipal,
  input: WeekTemplatePatchInput,
): Promise<PlanningResult<WeekTemplateRow>> {
  try {
    const existing = db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, id)).get()

    if (!existing) {
      return fail(savedNotFound())
    }

    const access = interpretRowAccess(existing, principal)
    if (access === 'legacy_unowned') {
      return fail(savedNotFound())
    }
    if (access === 'wrong_owner') {
      return fail(savedForbidden())
    }

    const patch: Partial<typeof mealWeekTemplates.$inferInsert> = { updatedAt: nowIso() }
    if (input.name !== undefined) patch.name = input.name
    if (input.body !== undefined) patch.body = input.body

    db.update(mealWeekTemplates)
      .set(patch)
      .where(and(eq(mealWeekTemplates.id, id), principalFilter(principal)))
      .run()

    const row = db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, id)).get()
    if (!row) {
      return fail(savedNotFound())
    }

    return ok(mapWeekTemplateRow(row))
  }
  catch (error) {
    return fail(storageError(error instanceof Error ? error.message : undefined, 'Saved weekplan could not be updated.'))
  }
}

/** Deletes a saved weekplan when owned by the principal. */
export async function deleteSavedWeekplan(
  db: AppDb,
  id: string,
  principal: PlanningPrincipal,
): Promise<PlanningResult<{ ok: true }>> {
  try {
    const existing = db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, id)).get()

    if (!existing) {
      return fail(savedNotFound())
    }

    const access = interpretRowAccess(existing, principal)
    if (access === 'legacy_unowned') {
      return fail(savedNotFound())
    }
    if (access === 'wrong_owner') {
      return fail(savedForbidden())
    }

    const deleted = db
      .delete(mealWeekTemplates)
      .where(and(eq(mealWeekTemplates.id, id), principalFilter(principal)))
      .returning({ id: mealWeekTemplates.id })
      .get()

    if (!deleted) {
      return fail(savedNotFound())
    }

    return ok({ ok: true })
  }
  catch (error) {
    return fail(storageError(error instanceof Error ? error.message : undefined, 'Saved weekplan could not be deleted.'))
  }
}
