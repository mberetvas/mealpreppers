import type { $Fetch } from 'ofetch'
import type { MonthPlanV1, WeekPlanV1 } from '../types/planning'

type PlannerWeekRowOk = {
  ok: true
  id: string
  name: string
  body: WeekPlanV1
  /** True when a consolidated shopping list row exists for this plan. */
  hasSavedShoppingList: boolean
  /** True when the saved list's source fingerprint no longer matches the current plan body. */
  shoppingListDeprecated: boolean
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
    const row = await fetcher<{ id: string, name: string, body: WeekPlanV1, hasSavedShoppingList: boolean, shoppingListDeprecated: boolean }>(`/api/v1/saved-weekplans/${tid}`)
    return {
      ok: true,
      id: row.id,
      name: row.name,
      body: row.body,
      hasSavedShoppingList: row.hasSavedShoppingList ?? false,
      shoppingListDeprecated: row.shoppingListDeprecated ?? false,
    }
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
