import type { PlanningPrincipal } from './planningPrincipal'

/** Columns used to decide whether a `meal_week_templates` row is visible to the Saved Weekplans API. */
export interface WeekTemplateOwnerColumns {
  owner_user_id: string | null
  anon_session_id: string | null
}

export type SavedWeekplanAccessInterpretation = 'matched' | 'legacy_unowned' | 'wrong_owner'

/** True when both owner columns are null (`legacy_unowned` migration debt). */
export function isLegacyUnownedWeekTemplateOwner(row: WeekTemplateOwnerColumns): boolean {
  return row.owner_user_id == null && row.anon_session_id == null
}

/**
 * Classifies row ownership relative to the current principal.
 * Legacy rows (both owner columns null) are only exposed via legacy week-templates routes.
 */
export function interpretSavedWeekplanAccess(
  row: WeekTemplateOwnerColumns,
  principal: PlanningPrincipal,
): SavedWeekplanAccessInterpretation {
  if (isLegacyUnownedWeekTemplateOwner(row)) return 'legacy_unowned'

  const hasUser = row.owner_user_id != null
  const hasAnon = row.anon_session_id != null

  if (principal.kind === 'user') {
    if (hasUser && row.owner_user_id === principal.userId) return 'matched'
    return 'wrong_owner'
  }

  if (hasAnon && row.anon_session_id === principal.sessionId && !hasUser) return 'matched'
  return 'wrong_owner'
}
