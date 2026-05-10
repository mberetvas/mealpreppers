import type { SupabaseClient } from '@supabase/supabase-js'
import type { WeekPlanV1, WeekTemplateCreateInput, WeekTemplatePatchInput } from '../../../types/planning'
import type { PlanningPrincipal } from './planningPrincipal'
import { fail, ok, type PlanningResult } from './planningResult'
import { interpretSavedWeekplanAccess } from './savedWeekplanAccess'
import type { WeekTemplateListItem, WeekTemplateRow } from './planningRepository'
import { anonymousSavedWeekplanIdleCutoffIso } from './anonymousSavedWeekplansIdlePurge'

interface WeekTemplateDbRow {
  id: string
  name: string
  body: WeekPlanV1
  created_at: string
  updated_at: string
  owner_user_id: string | null
  anon_session_id: string | null
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

function ownerInsertPayload(principal: PlanningPrincipal): { owner_user_id: string | null, anon_session_id: string | null } {
  if (principal.kind === 'user') {
    return { owner_user_id: principal.userId, anon_session_id: null }
  }
  return { owner_user_id: null, anon_session_id: principal.sessionId }
}

/** Lists saved weekplans visible to the current principal (excludes legacy unowned rows). */
export async function listSavedWeekplans(
  client: SupabaseClient,
  principal: PlanningPrincipal,
): Promise<PlanningResult<WeekTemplateListItem[]>> {
  let q = client.from('meal_week_templates').select('id, name, updated_at')

  if (principal.kind === 'user') {
    q = q.eq('owner_user_id', principal.userId).is('anon_session_id', null)
  }
  else {
    q = q.eq('anon_session_id', principal.sessionId).is('owner_user_id', null)
  }

  const { data, error } = await q.order('updated_at', { ascending: false })

  if (error || !data) {
    return fail(storageError(error?.message, 'Saved weekplans could not be loaded.'))
  }

  return ok((data as Pick<WeekTemplateDbRow, 'id' | 'name' | 'updated_at'>[]).map(row => ({
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
  })))
}

/** Fetches one saved weekplan by id when owned by the principal. */
export async function getSavedWeekplanById(
  client: SupabaseClient,
  id: string,
  principal: PlanningPrincipal,
): Promise<PlanningResult<WeekTemplateRow>> {
  const { data, error } = await client
    .from('meal_week_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return fail(storageError(error.message, 'Saved weekplan could not be loaded.'))
  }

  if (!data) {
    return fail(savedNotFound())
  }

  const row = data as WeekTemplateDbRow
  const access = interpretSavedWeekplanAccess(row, principal)
  if (access === 'legacy_unowned') {
    return fail(savedNotFound())
  }
  if (access === 'wrong_owner') {
    return fail(savedForbidden())
  }

  return ok(mapWeekTemplateRow(row))
}

/** Creates a saved weekplan row owned by the current principal. */
export async function createSavedWeekplan(
  client: SupabaseClient,
  principal: PlanningPrincipal,
  input: WeekTemplateCreateInput,
): Promise<PlanningResult<WeekTemplateRow>> {
  const owners = ownerInsertPayload(principal)
  const { data, error } = await client
    .from('meal_week_templates')
    .insert({ name: input.name, body: input.body, ...owners })
    .select('*')
    .single()

  if (error || !data) {
    return fail(storageError(error?.message, 'Saved weekplan could not be created.'))
  }

  return ok(mapWeekTemplateRow(data as WeekTemplateDbRow))
}

/** Updates a saved weekplan when owned by the principal. */
export async function updateSavedWeekplan(
  client: SupabaseClient,
  id: string,
  principal: PlanningPrincipal,
  input: WeekTemplatePatchInput,
): Promise<PlanningResult<WeekTemplateRow>> {
  const { data: existing, error: loadError } = await client
    .from('meal_week_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (loadError) {
    return fail(storageError(loadError.message, 'Saved weekplan could not be updated.'))
  }

  if (!existing) {
    return fail(savedNotFound())
  }

  const existingRow = existing as WeekTemplateDbRow
  const access = interpretSavedWeekplanAccess(existingRow, principal)
  if (access === 'legacy_unowned') {
    return fail(savedNotFound())
  }
  if (access === 'wrong_owner') {
    return fail(savedForbidden())
  }

  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.body !== undefined) patch.body = input.body

  let q = client.from('meal_week_templates').update(patch).eq('id', id)
  if (principal.kind === 'user') {
    q = q.eq('owner_user_id', principal.userId).is('anon_session_id', null)
  }
  else {
    q = q.eq('anon_session_id', principal.sessionId).is('owner_user_id', null)
  }

  const { data, error } = await q.select('*').single()

  if (error || !data) {
    if (error?.code === 'PGRST116') {
      return fail(savedNotFound())
    }
    return fail(storageError(error?.message, 'Saved weekplan could not be updated.'))
  }

  return ok(mapWeekTemplateRow(data as WeekTemplateDbRow))
}

/** Deletes a saved weekplan when owned by the principal. */
export async function deleteSavedWeekplan(
  client: SupabaseClient,
  id: string,
  principal: PlanningPrincipal,
): Promise<PlanningResult<{ ok: true }>> {
  const { data: existing, error: loadError } = await client
    .from('meal_week_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (loadError) {
    return fail(storageError(loadError.message, 'Saved weekplan could not be deleted.'))
  }

  if (!existing) {
    return fail(savedNotFound())
  }

  const existingRow = existing as WeekTemplateDbRow
  const access = interpretSavedWeekplanAccess(existingRow, principal)
  if (access === 'legacy_unowned') {
    return fail(savedNotFound())
  }
  if (access === 'wrong_owner') {
    return fail(savedForbidden())
  }

  let q = client.from('meal_week_templates').delete().eq('id', id)
  if (principal.kind === 'user') {
    q = q.eq('owner_user_id', principal.userId).is('anon_session_id', null)
  }
  else {
    q = q.eq('anon_session_id', principal.sessionId).is('owner_user_id', null)
  }

  const { data, error } = await q.select('id').maybeSingle()

  if (error) {
    return fail(storageError(error.message, 'Saved weekplan could not be deleted.'))
  }

  if (!data) {
    return fail(savedNotFound())
  }

  return ok({ ok: true })
}

/** Counts Saved Weekplans still tied to an anonymous session (not yet owned by a user). */
export async function countAnonymousSavedWeekplansForSession(
  client: SupabaseClient,
  sessionId: string,
): Promise<PlanningResult<number>> {
  const { count, error } = await client
    .from('meal_week_templates')
    .select('*', { count: 'exact', head: true })
    .eq('anon_session_id', sessionId)
    .is('owner_user_id', null)

  if (error) {
    return fail(storageError(error.message, 'Saved weekplans could not be counted.'))
  }
  return ok(count ?? 0)
}

/** Reassigns all anonymous-session Saved Weekplans for `sessionId` to `userId` and clears anon linkage. */
export async function mergeAnonymousSavedWeekplansToUser(
  client: SupabaseClient,
  sessionId: string,
  userId: string,
): Promise<PlanningResult<{ moved: number }>> {
  const { data, error } = await client
    .from('meal_week_templates')
    .update({ owner_user_id: userId, anon_session_id: null })
    .eq('anon_session_id', sessionId)
    .is('owner_user_id', null)
    .select('id')

  if (error) {
    return fail(storageError(error.message, 'Saved weekplans could not be moved to your account.'))
  }
  return ok({ moved: (data as { id: string }[] | null)?.length ?? 0 })
}

/** Deletes Saved Weekplans owned only by the anonymous session (hard delete; no anonymous retention). */
export async function discardAnonymousSavedWeekplansForSession(
  client: SupabaseClient,
  sessionId: string,
): Promise<PlanningResult<{ deleted: number }>> {
  const { data, error } = await client
    .from('meal_week_templates')
    .delete()
    .eq('anon_session_id', sessionId)
    .is('owner_user_id', null)
    .select('id')

  if (error) {
    return fail(storageError(error.message, 'Saved weekplans could not be discarded.'))
  }
  return ok({ deleted: (data as { id: string }[] | null)?.length ?? 0 })
}

/**
 * Hard-deletes anonymous-owned saved weekplans whose `updated_at` is older than the idle retention window.
 * Does not touch user-owned rows or legacy rows with both owner columns null.
 */
export async function purgeAnonymousIdleSavedWeekplans(
  client: SupabaseClient,
  options?: { now?: Date },
): Promise<PlanningResult<{ deleted: number }>> {
  const now = options?.now ?? new Date()
  const cutoffIso = anonymousSavedWeekplanIdleCutoffIso(now)
  const { data, error } = await client
    .from('meal_week_templates')
    .delete()
    .is('owner_user_id', null)
    .not('anon_session_id', 'is', null)
    .lt('updated_at', cutoffIso)
    .select('id')

  if (error) {
    return fail(storageError(error.message, 'Idle anonymous saved weekplans could not be purged.'))
  }
  return ok({ deleted: (data as { id: string }[] | null)?.length ?? 0 })
}
