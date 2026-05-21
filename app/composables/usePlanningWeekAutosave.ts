import { createPlanningWeekAutosave, type PlannerWeekSaveStatus } from '~~/utils/planningAutosave'
import type { WeekPlanV1, WeekTemplatePatchInput } from '~~/types/planning'

/** Whether the week tab is linked to a Saved Weekplan row (`none` = unsaved draft). */
export type WeekPlannerPersistenceKind = 'none' | 'saved-weekplan'

/**
 * Debounced autosave for the weekly planner when a Saved Weekplan is linked.
 * Draft mode (`none`) never PATCHes until an id exists after explicit first save.
 */
export function usePlanningWeekAutosave(
  weekPlan: Ref<WeekPlanV1>,
  activeTemplateId: Ref<string | null>,
  saveStatus: Ref<PlannerWeekSaveStatus>,
  weekPlanTitle: Ref<string>,
  persistenceKind: Ref<WeekPlannerPersistenceKind>,
) {
  const ctrl = createPlanningWeekAutosave({
    debounceMs: 700,
    getTemplateId: () => activeTemplateId.value,
    getWeekBody: () => weekPlan.value,
    getWeekName: () =>
      persistenceKind.value === 'none' ? null : weekPlanTitle.value,
    patch: (id, input: WeekTemplatePatchInput) =>
      $fetch(`/api/v1/saved-weekplans/${id}`, { method: 'PATCH', body: input }),
    onDirty: () => { saveStatus.value = 'dirty' },
    onSaving: () => { saveStatus.value = 'saving' },
    onSaved: () => { saveStatus.value = 'saved' },
    onError: () => { saveStatus.value = 'error' },
  })

  watch(weekPlan, () => ctrl.notifyWeekPlanChanged(), { deep: true })
  watch(weekPlanTitle, () => ctrl.notifyWeekPlanChanged())
  onBeforeUnmount(() => ctrl.cancel())
}
