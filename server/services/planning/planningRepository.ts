import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  MonthPlanCreateInput,
  MonthPlanPatchInput,
  MonthPlanV1,
  WeekPlanV1,
  WeekTemplateCreateInput,
  WeekTemplatePatchInput,
} from '../../../types/planning'

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

interface WeekTemplateDbRow {
  id: string
  name: string
  body: WeekPlanV1
  created_at: string
  updated_at: string
}

interface MonthPlanDbRow {
  id: string
  name: string | null
  body: MonthPlanV1
  created_at: string
  updated_at: string
}

export async function listWeekTemplates(client: SupabaseClient): Promise<WeekTemplateListItem[]> {
  const { data, error } = await client
    .from('meal_week_templates')
    .select('id, name, updated_at')
    .order('updated_at', { ascending: false })

  if (error || !data) {
    throw createError({ statusCode: 500, statusMessage: error?.message ?? 'Week templates could not be loaded.' })
  }

  return (data as Pick<WeekTemplateDbRow, 'id' | 'name' | 'updated_at'>[]).map(row => ({
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
  }))
}

export async function getWeekTemplateById(client: SupabaseClient, id: string): Promise<WeekTemplateRow | null> {
  const { data, error } = await client
    .from('meal_week_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message ?? 'Week template could not be loaded.' })
  }

  if (!data) return null

  const row = data as WeekTemplateDbRow
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function createWeekTemplate(client: SupabaseClient, input: WeekTemplateCreateInput): Promise<WeekTemplateRow> {
  const { data, error } = await client
    .from('meal_week_templates')
    .insert({ name: input.name, body: input.body })
    .select('*')
    .single()

  if (error || !data) {
    throw createError({ statusCode: 500, statusMessage: error?.message ?? 'Week template could not be created.' })
  }

  return mapWeekTemplateRow(data as WeekTemplateDbRow)
}

export async function updateWeekTemplate(client: SupabaseClient, id: string, input: WeekTemplatePatchInput): Promise<WeekTemplateRow> {
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.body !== undefined) patch.body = input.body

  const { data, error } = await client
    .from('meal_week_templates')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    if (error?.code === 'PGRST116') {
      throw createError({ statusCode: 404, statusMessage: 'Week template not found.' })
    }
    throw createError({ statusCode: 500, statusMessage: error?.message ?? 'Week template could not be updated.' })
  }

  return mapWeekTemplateRow(data as WeekTemplateDbRow)
}

export async function deleteWeekTemplate(client: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await client
    .from('meal_week_templates')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message ?? 'Week template could not be deleted.' })
  }

  return !!data
}

export async function listMonthPlans(client: SupabaseClient): Promise<MonthPlanListItem[]> {
  const { data, error } = await client
    .from('meal_month_plans')
    .select('id, name, updated_at')
    .order('updated_at', { ascending: false })

  if (error || !data) {
    throw createError({ statusCode: 500, statusMessage: error?.message ?? 'Month plans could not be loaded.' })
  }

  return (data as Pick<MonthPlanDbRow, 'id' | 'name' | 'updated_at'>[]).map(row => ({
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
  }))
}

export async function getMonthPlanById(client: SupabaseClient, id: string): Promise<MonthPlanRow | null> {
  const { data, error } = await client
    .from('meal_month_plans')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message ?? 'Month plan could not be loaded.' })
  }

  if (!data) return null

  const row = data as MonthPlanDbRow
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function createMonthPlan(client: SupabaseClient, input: MonthPlanCreateInput): Promise<MonthPlanRow> {
  const { data, error } = await client
    .from('meal_month_plans')
    .insert({
      name: input.name ?? null,
      body: input.body,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw createError({ statusCode: 500, statusMessage: error?.message ?? 'Month plan could not be created.' })
  }

  return mapMonthPlanRow(data as MonthPlanDbRow)
}

export async function updateMonthPlan(client: SupabaseClient, id: string, input: MonthPlanPatchInput): Promise<MonthPlanRow> {
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
      throw createError({ statusCode: 404, statusMessage: 'Month plan not found.' })
    }
    throw createError({ statusCode: 500, statusMessage: error?.message ?? 'Month plan could not be updated.' })
  }

  return mapMonthPlanRow(data as MonthPlanDbRow)
}

export async function deleteMonthPlan(client: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await client
    .from('meal_month_plans')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message ?? 'Month plan could not be deleted.' })
  }

  return !!data
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
 * Ensures every non-null recipe id exists in `recipes`. Throws 400 when any are missing.
 */
export async function assertRecipeIdsExist(client: SupabaseClient, recipeIds: string[]): Promise<void> {
  if (recipeIds.length === 0) return

  const { data, error } = await client
    .from('recipes')
    .select('id')
    .in('id', recipeIds)

  if (error || !data) {
    throw createError({ statusCode: 500, statusMessage: error?.message ?? 'Recipe validation failed.' })
  }

  const found = new Set((data as { id: string }[]).map(r => r.id))
  const missing = recipeIds.filter(id => !found.has(id))
  if (missing.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'One or more recipe ids are not in the catalog.',
      data: { missingRecipeIds: missing },
    })
  }
}

function mapWeekTemplateRow(row: WeekTemplateDbRow): WeekTemplateRow {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
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
