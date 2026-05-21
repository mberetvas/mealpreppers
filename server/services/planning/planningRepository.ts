import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  MonthPlanCreateInput,
  MonthPlanPatchInput,
  MonthPlanV1,
  WeekPlanV1,
} from '../../../types/planning'
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

interface MonthPlanDbRow {
  id: string
  name: string | null
  body: MonthPlanV1
  created_at: string
  updated_at: string
}

export async function listMonthPlans(client: SupabaseClient): Promise<PlanningResult<MonthPlanListItem[]>> {
  const { data, error } = await client
    .from('meal_month_plans')
    .select('id, name, updated_at')
    .order('updated_at', { ascending: false })

  if (error || !data) {
    return fail(storageError(error?.message, 'Month plans could not be loaded.'))
  }

  return ok((data as Pick<MonthPlanDbRow, 'id' | 'name' | 'updated_at'>[]).map(row => ({
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
  })))
}

export async function getMonthPlanById(client: SupabaseClient, id: string): Promise<PlanningResult<MonthPlanRow>> {
  const { data, error } = await client
    .from('meal_month_plans')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return fail(storageError(error.message, 'Month plan could not be loaded.'))
  }

  if (!data) {
    return fail(notFoundError('month_plan', 'Month plan not found.'))
  }

  const row = data as MonthPlanDbRow
  return ok({
    id: row.id,
    name: row.name,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

export async function createMonthPlan(client: SupabaseClient, input: MonthPlanCreateInput): Promise<PlanningResult<MonthPlanRow>> {
  const { data, error } = await client
    .from('meal_month_plans')
    .insert({
      name: input.name ?? null,
      body: input.body,
    })
    .select('*')
    .single()

  if (error || !data) {
    return fail(storageError(error?.message, 'Month plan could not be created.'))
  }

  return ok(mapMonthPlanRow(data as MonthPlanDbRow))
}

export async function updateMonthPlan(client: SupabaseClient, id: string, input: MonthPlanPatchInput): Promise<PlanningResult<MonthPlanRow>> {
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.body !== undefined) patch.body = input.body

  const { data, error } = await client
    .from('meal_month_plans')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    if (error?.code === 'PGRST116') {
      return fail(notFoundError('month_plan', 'Month plan not found.'))
    }
    return fail(storageError(error?.message, 'Month plan could not be updated.'))
  }

  return ok(mapMonthPlanRow(data as MonthPlanDbRow))
}

export async function deleteMonthPlan(client: SupabaseClient, id: string): Promise<PlanningResult<{ ok: true }>> {
  const { data, error } = await client
    .from('meal_month_plans')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    return fail(storageError(error.message, 'Month plan could not be deleted.'))
  }

  if (!data) {
    return fail(notFoundError('month_plan', 'Month plan not found.'))
  }

  return ok({ ok: true })
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
export async function assertRecipeIdsExist(client: SupabaseClient, recipeIds: string[]): Promise<PlanningResult<void>> {
  if (recipeIds.length === 0) return ok(undefined)

  const { data, error } = await client
    .from('recipes')
    .select('id')
    .in('id', recipeIds)

  if (error || !data) {
    return fail(storageError(error?.message, 'Recipe validation failed.'))
  }

  const found = new Set((data as { id: string }[]).map(r => r.id))
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

function mapMonthPlanRow(row: MonthPlanDbRow): MonthPlanRow {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
