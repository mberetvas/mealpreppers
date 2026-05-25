import type { SupabaseClient } from '@supabase/supabase-js'
import { fail, ok, type PlanningResult } from './planningResult'

/** Default number of `legacy_unowned` row ids returned for HITL review. */
export const DEFAULT_LEGACY_UNOWNED_SAMPLE_LIMIT = 10

export interface LegacyUnownedWeekTemplatesAudit {
  count: number
  sampleIds: string[]
}

export interface AuditLegacyUnownedOptions {
  sampleLimit?: number
}

/**
 * Counts `meal_week_templates` rows with both owner columns null (`legacy_unowned`).
 * Used before retiring unscoped week-templates routes.
 */
export async function auditLegacyUnownedWeekTemplates(
  client: SupabaseClient,
  options: AuditLegacyUnownedOptions = {},
): Promise<PlanningResult<LegacyUnownedWeekTemplatesAudit>> {
  const sampleLimit = options.sampleLimit ?? DEFAULT_LEGACY_UNOWNED_SAMPLE_LIMIT

  const { count, error: countError } = await client
    .from('meal_week_templates')
    .select('*', { count: 'exact', head: true })
    .is('owner_user_id', null)
    .is('anon_session_id', null)

  if (countError || count == null) {
    return fail({
      kind: 'storage_error',
      message: countError?.message ?? 'Legacy unowned week template audit could not run.',
    })
  }

  if (count === 0) {
    return ok({ count: 0, sampleIds: [] })
  }

  const { data, error: sampleError } = await client
    .from('meal_week_templates')
    .select('id')
    .is('owner_user_id', null)
    .is('anon_session_id', null)
    .order('updated_at', { ascending: false })
    .limit(sampleLimit)

  if (sampleError || !data) {
    return fail({
      kind: 'storage_error',
      message: sampleError?.message ?? 'Legacy unowned week template sample could not be loaded.',
    })
  }

  return ok({
    count,
    sampleIds: (data as { id: string }[]).map(row => row.id),
  })
}
