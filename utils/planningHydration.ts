import type { $Fetch } from 'ofetch'
import type { MonthPlanV1, WeekPlanV1 } from '../types/planning'

/** Loads a week template row for the planner, or reports failure (invalid id or request error). */
export async function fetchWeekTemplateRowForPlanner(
  fetcher: $Fetch,
  templateId: string,
): Promise<{ ok: true, id: string, body: WeekPlanV1 } | { ok: false }> {
  const tid = templateId.trim()
  if (!tid) {
    return { ok: false }
  }
  try {
    const row = await fetcher<{ id: string, body: WeekPlanV1 }>(`/api/v1/planning/week-templates/${tid}`)
    return { ok: true, id: row.id, body: row.body }
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
