/**
 * Shared semantics for dynamic form/planner feedback so visible copy and
 * assistive announcements stay aligned (PRD: State Messaging Contract).
 */
export const STATE_MESSAGING_CONTRACT_LABEL = 'State messaging contract'

/** Planner week autosave surface uses error vs non-error ARIA urgency. */
export type PlannerWeekSaveStatus = 'saved' | 'saving' | 'dirty' | 'error'

/**
 * Returns role and aria-live for the visible planner save status chip.
 * Errors use assertive alerts; other transitions stay polite status.
 */
export function ariaForPlannerWeekSaveStatus(status: PlannerWeekSaveStatus): {
  role: 'alert' | 'status'
  ariaLive: 'assertive' | 'polite'
} {
  if (status === 'error')
    return { role: 'alert', ariaLive: 'assertive' }
  return { role: 'status', ariaLive: 'polite' }
}
