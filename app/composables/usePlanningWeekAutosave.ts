import { createPlanningWeekAutosave, type PlannerWeekSaveStatus } from '~~/utils/planningAutosave'
import type { WeekPlanV1 } from '~~/types/planning'

/**
 * Debounced autosave for the weekly planner when a template is linked.
 */
export function usePlanningWeekAutosave(
  weekPlan: Ref<WeekPlanV1>,
  activeTemplateId: Ref<string | null>,
  saveStatus: Ref<PlannerWeekSaveStatus>,
) {
  const ctrl = createPlanningWeekAutosave({
    debounceMs: 700,
    getTemplateId: () => activeTemplateId.value,
    getWeekBody: () => weekPlan.value,
    patch: (id, body) =>
      $fetch(`/api/v1/planning/week-templates/${id}`, {
        method: 'PATCH',
        body: { body },
      }),
    onDirty: () => { saveStatus.value = 'dirty' },
    onSaving: () => { saveStatus.value = 'saving' },
    onSaved: () => { saveStatus.value = 'saved' },
    onError: () => { saveStatus.value = 'error' },
  })

  watch(weekPlan, () => ctrl.notifyWeekPlanChanged(), { deep: true })
  onBeforeUnmount(() => ctrl.cancel())
}
