import { randomUUID } from 'node:crypto'
import { desc, eq, inArray } from 'drizzle-orm'
import type {
  MonthPlanCreateInput,
  MonthPlanPatchInput,
  MonthPlanV1,
  WeekPlanV1,
} from '../../../types/planning'
import type { AppDb } from '../../db/sqlite'
import { mealMonthPlans } from '../../db/schema/planning'
import { recipes } from '../../db/schema/recipeCatalog'
import { fail, ok, type PlanningResult } from './planningResult'

export interface WeekTemplateListItem {
  id: string
  name: string
  updatedAt: string
}

export interface WeekTemplateRow extends WeekTemplateListItem {
  body: WeekPlanV1
  createdAt: string
}

export interface MonthPlanListItem {
  id: string
  name: string | null
  updatedAt: string
}

export interface MonthPlanRow extends MonthPlanListItem {
  body: MonthPlanV1
  createdAt: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function mapMonthPlanRow(row: typeof mealMonthPlans.$inferSelect): MonthPlanRow {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** Lists month plans ordered by most recently updated. */
export async function listMonthPlans(db: AppDb): Promise<PlanningResult<MonthPlanListItem[]>> {
  try {
    const rows = db
      .select({
        id: mealMonthPlans.id,
        name: mealMonthPlans.name,
        updatedAt: mealMonthPlans.updatedAt,
      })
      .from(mealMonthPlans)
      .orderBy(desc(mealMonthPlans.updatedAt))
      .all()

    return ok(rows)
  }
  catch (error) {
    return fail(storageError(error instanceof Error ? error.message : undefined, 'Month plans could not be loaded.'))
  }
}

/** Fetches one month plan by id. */
export async function getMonthPlanById(db: AppDb, id: string): Promise<PlanningResult<MonthPlanRow>> {
  try {
    const row = db.select().from(mealMonthPlans).where(eq(mealMonthPlans.id, id)).get()

    if (!row) {
      return fail(notFoundError('month_plan', 'Month plan not found.'))
    }

    return ok(mapMonthPlanRow(row))
  }
  catch (error) {
    return fail(storageError(error instanceof Error ? error.message : undefined, 'Month plan could not be loaded.'))
  }
}

/** Creates a month plan row. */
export async function createMonthPlan(db: AppDb, input: MonthPlanCreateInput): Promise<PlanningResult<MonthPlanRow>> {
  try {
    const timestamp = nowIso()
    const id = randomUUID()

    db.insert(mealMonthPlans).values({
      id,
      name: input.name ?? null,
      body: input.body,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run()

    const row = db.select().from(mealMonthPlans).where(eq(mealMonthPlans.id, id)).get()
    if (!row) {
      return fail(storageError(undefined, 'Month plan could not be created.'))
    }

    return ok(mapMonthPlanRow(row))
  }
  catch (error) {
    return fail(storageError(error instanceof Error ? error.message : undefined, 'Month plan could not be created.'))
  }
}

/** Patches a month plan row. */
export async function updateMonthPlan(db: AppDb, id: string, input: MonthPlanPatchInput): Promise<PlanningResult<MonthPlanRow>> {
  try {
    const existing = db.select().from(mealMonthPlans).where(eq(mealMonthPlans.id, id)).get()
    if (!existing) {
      return fail(notFoundError('month_plan', 'Month plan not found.'))
    }

    const patch: Partial<typeof mealMonthPlans.$inferInsert> = { updatedAt: nowIso() }
    if (input.name !== undefined) patch.name = input.name
    if (input.body !== undefined) patch.body = input.body

    db.update(mealMonthPlans).set(patch).where(eq(mealMonthPlans.id, id)).run()

    const row = db.select().from(mealMonthPlans).where(eq(mealMonthPlans.id, id)).get()
    if (!row) {
      return fail(notFoundError('month_plan', 'Month plan not found.'))
    }

    return ok(mapMonthPlanRow(row))
  }
  catch (error) {
    return fail(storageError(error instanceof Error ? error.message : undefined, 'Month plan could not be updated.'))
  }
}

/** Deletes a month plan row. */
export async function deleteMonthPlan(db: AppDb, id: string): Promise<PlanningResult<{ ok: true }>> {
  try {
    const deleted = db.delete(mealMonthPlans).where(eq(mealMonthPlans.id, id)).returning({ id: mealMonthPlans.id }).get()

    if (!deleted) {
      return fail(notFoundError('month_plan', 'Month plan not found.'))
    }

    return ok({ ok: true })
  }
  catch (error) {
    return fail(storageError(error instanceof Error ? error.message : undefined, 'Month plan could not be deleted.'))
  }
}

/**
 * Returns recipe ids referenced in a week plan (non-null slots).
 */
export function collectRecipeIdsFromWeekPlan(plan: WeekPlanV1): string[] {
  const ids: string[] = []
  for (const dayKey of ['1', '2', '3', '4', '5', '6', '7'] as const) {
    const day = plan.days[dayKey]
    for (const slot of [day.breakfast, day.lunch, day.dinner]) {
      if (slot.recipeId) ids.push(slot.recipeId)
    }
  }
  return [...new Set(ids)]
}

export function collectRecipeIdsFromMonthPlan(plan: MonthPlanV1): string[] {
  const ids = new Set<string>()
  for (const week of plan.weeks) {
    if (!week) continue
    for (const id of collectRecipeIdsFromWeekPlan(week)) {
      ids.add(id)
    }
  }
  return [...ids]
}

/**
 * Ensures every non-null recipe id exists in `recipes`.
 */
export async function assertRecipeIdsExist(db: AppDb, recipeIds: string[]): Promise<PlanningResult<void>> {
  if (recipeIds.length === 0) return ok(undefined)

  try {
    const rows = db
      .select({ id: recipes.id })
      .from(recipes)
      .where(inArray(recipes.id, recipeIds))
      .all()

    const found = new Set(rows.map(r => r.id))
    const missing = recipeIds.filter(id => !found.has(id))
    if (missing.length > 0) {
      return fail({
        kind: 'invalid_recipe_ids',
        message: 'One or more recipe ids are not in the catalog.',
        missingRecipeIds: missing,
      })
    }

    return ok(undefined)
  }
  catch (error) {
    return fail(storageError(error instanceof Error ? error.message : undefined, 'Recipe validation failed.'))
  }
}

function storageError(message: string | undefined, fallback: string) {
  return {
    kind: 'storage_error' as const,
    message: message ?? fallback,
  }
}

function notFoundError(entity: 'month_plan', message: string) {
  return {
    kind: 'not_found' as const,
    entity,
    message,
  }
}
