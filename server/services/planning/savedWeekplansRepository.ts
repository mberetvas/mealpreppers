import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { WeekPlanV1, WeekTemplateCreateInput, WeekTemplatePatchInput } from '../../../types/planning'
import type { AppDb } from '../../db/sqlite'
import { mealWeekTemplates } from '../../db/schema/planning'
import type { PlanningPrincipal } from './planningPrincipal'
import { fail, ok, type PlanningResult } from './planningResult'
import type { SavedWeekplanReader } from './ports/savedWeekplanReader'
import { savedWeekplanNotFound } from './savedWeekplanAccessErrors'
import { computeShoppingListFlags } from './savedWeekplanReadModel'
import type { WeekTemplateListItem, WeekTemplateRow } from './planningRepository'

function nowIso(): string {
  return new Date().toISOString()
}

function mapWeekTemplateRow(row: {
  id: string
  name: string
  body: WeekPlanV1
  createdAt: string
  updatedAt: string
}): WeekTemplateRow {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
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

/** Inserts a saved weekplan row (transaction-safe). Used by the create application module. */
export function insertSavedWeekplanRow(
  db: AppDb,
  principal: PlanningPrincipal,
  input: WeekTemplateCreateInput,
): PlanningResult<WeekTemplateRow> {
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

/** Lists saved weekplans visible to the current principal (excludes legacy unowned rows). Each row includes shopping list status flags. */
export async function listSavedWeekplans(
  db: AppDb,
  principal: PlanningPrincipal,
  reader: SavedWeekplanReader,
): Promise<PlanningResult<WeekTemplateListItemWithShoppingListFlags[]>> {
  const result = await reader.listForPrincipal(db, principal)
  if (!result.ok) {
    return result
  }

  return ok(result.value.map(row => ({
    id: row.id,
    name: row.name,
    updatedAt: row.updatedAt,
    ...computeShoppingListFlags(row.consolidatedShoppingList, row.body),
  })))
}

/** Fetches one saved weekplan by id when owned by the principal. */
export async function getSavedWeekplanById(
  db: AppDb,
  id: string,
  principal: PlanningPrincipal,
  reader: SavedWeekplanReader,
): Promise<PlanningResult<WeekTemplateRow>> {
  const result = await reader.getById(db, id, principal)
  if (!result.ok) {
    return result
  }
  return ok(mapWeekTemplateRow(result.value))
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
  reader: SavedWeekplanReader,
): Promise<PlanningResult<WeekTemplateRowWithShoppingListFlags>> {
  const result = await reader.getById(db, id, principal)
  if (!result.ok) {
    return result
  }

  const flags = computeShoppingListFlags(result.value.consolidatedShoppingList, result.value.body)
  return ok({ ...mapWeekTemplateRow(result.value), ...flags })
}

/** Updates a saved weekplan when owned by the principal. */
export async function updateSavedWeekplan(
  db: AppDb,
  id: string,
  principal: PlanningPrincipal,
  input: WeekTemplatePatchInput,
  reader: SavedWeekplanReader,
): Promise<PlanningResult<WeekTemplateRow>> {
  try {
    const access = await reader.getById(db, id, principal)
    if (!access.ok) {
      return access
    }

    const patch: Partial<typeof mealWeekTemplates.$inferInsert> = { updatedAt: nowIso() }
    if (input.name !== undefined) patch.name = input.name
    if (input.body !== undefined) patch.body = input.body

    db.update(mealWeekTemplates)
      .set(patch)
      .where(eq(mealWeekTemplates.id, id))
      .run()

    const row = db.select().from(mealWeekTemplates).where(eq(mealWeekTemplates.id, id)).get()
    if (!row) {
      return fail(savedWeekplanNotFound())
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
  reader: SavedWeekplanReader,
): Promise<PlanningResult<{ ok: true }>> {
  try {
    const access = await reader.getById(db, id, principal)
    if (!access.ok) {
      return access
    }

    const deleted = db
      .delete(mealWeekTemplates)
      .where(eq(mealWeekTemplates.id, id))
      .returning({ id: mealWeekTemplates.id })
      .get()

    if (!deleted) {
      return fail(savedWeekplanNotFound())
    }

    return ok({ ok: true })
  }
  catch (error) {
    return fail(storageError(error instanceof Error ? error.message : undefined, 'Saved weekplan could not be deleted.'))
  }
}
