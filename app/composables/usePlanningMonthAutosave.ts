import { createPlanningMonthAutosave } from '~~/utils/planningAutosave'
import type { MonthPlanV1 } from '~~/types/planning'

/**
 * Debounced autosave for the active month plan document.
 */
export function usePlanningMonthAutosave(
  monthPlan: Ref<MonthPlanV1>,
  activeMonthId: Ref<string | null>,
) {
  const ctrl = createPlanningMonthAutosave({
    debounceMs: 800,
    getMonthPlanId: () => activeMonthId.value,
    getBody: () => monthPlan.value,
    patch: (id, body) =>
      $fetch(`/api/v1/planning/month-plans/${id}`, {
        method: 'PATCH',
        body: { body },
      }),
  })

  watch(monthPlan, () => ctrl.notifyMonthPlanChanged(), { deep: true })
  onBeforeUnmount(() => ctrl.cancel())
}
