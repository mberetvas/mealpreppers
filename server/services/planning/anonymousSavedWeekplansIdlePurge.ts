/**
 * Anonymous Saved Weekplans that stay idle (no updates) for longer than the retention window
 * may be purged. **Idle** is defined as `meal_week_templates.updated_at` (PRD).
 */
export const ANONYMOUS_SAVED_WEEKPLAN_IDLE_RETENTION_DAYS = 90

const MS_PER_DAY = 86_400_000

/** ISO timestamp strictly before which anonymous-owned rows are eligible for idle purge. */
export function anonymousSavedWeekplanIdleCutoffIso(now: Date): string {
  const cutoffMs = now.getTime() - ANONYMOUS_SAVED_WEEKPLAN_IDLE_RETENTION_DAYS * MS_PER_DAY
  return new Date(cutoffMs).toISOString()
}
