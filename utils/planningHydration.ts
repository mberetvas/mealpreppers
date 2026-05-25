import type { $Fetch } from 'ofetch'
import type { MonthPlanV1, WeekPlanV1 } from '../types/planning'

type PlannerWeekRowOk = {
  ok: true
  id: string
  name: string
  body: WeekPlanV1
}

/** Loads a week plan row for the planner via principal-scoped Saved Weekplans. */
export async function fetchSavedWeekplanForPlanner(
  fetcher: $Fetch,
  templateId: string,
): Promise<PlannerWeekRowOk | { ok: false }> {
  const tid = templateId.trim()
  if (!tid) {
    return { ok: false }
  }
  try {
    const row = await fetcher<{ id: string, name: string, body: WeekPlanV1 }>(`/api/v1/saved-weekplans/${tid}`)
    return { ok: true, id: row.id, name: row.name, body: row.body }
  }
  catch {
    return { ok: false }
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
