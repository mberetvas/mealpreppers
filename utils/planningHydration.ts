import type { $Fetch } from 'ofetch'
import type { MonthPlanV1, WeekPlanV1 } from '../types/planning'

/** Where a planner week row was resolved from (drives PATCH URL after load). */
export type PlannerWeekRowSource = 'saved-weekplan' | 'week-template'

type PlannerWeekRowOk = {
  ok: true
  id: string
  name: string
  body: WeekPlanV1
  source: PlannerWeekRowSource
}

/**
 * Loads a week plan row for the planner: Saved Weekplans first, then legacy `week-templates`
 * (staged deprecation — see `server/api/v1/planning/week-templates/DEPRECATED.md`).
 */
export async function fetchWeekTemplateRowForPlanner(
  fetcher: $Fetch,
  templateId: string,
): Promise<PlannerWeekRowOk | { ok: false }> {
  const tid = templateId.trim()
  if (!tid) {
    return { ok: false }
  }
  try {
    const row = await fetcher<{ id: string, name: string, body: WeekPlanV1 }>(`/api/v1/saved-weekplans/${tid}`)
    return { ok: true, id: row.id, name: row.name, body: row.body, source: 'saved-weekplan' }
  }
  catch {
    try {
      const row = await fetcher<{ id: string, name: string, body: WeekPlanV1 }>(`/api/v1/planning/week-templates/${tid}`)
      return { ok: true, id: row.id, name: row.name, body: row.body, source: 'week-template' }
    }
    catch {
      return { ok: false }
    }
  }
}

/** Loads month plan body for the planner, or reports failure. */
export async function fetchMonthPlanBodyForPlanner(
  fetcher: $Fetch,
  monthPlanId: string,
): Promise<{ ok: true, body: MonthPlanV1 } | { ok: false }> {
  try {
    const row = await fetcher<{ body: MonthPlanV1 }>(`/api/v1/planning/month-plans/${monthPlanId}`)
    return { ok: true, body: row.body }
  }
  catch {
    return { ok: false }
  }
}
