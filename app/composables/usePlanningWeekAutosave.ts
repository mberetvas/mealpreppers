import { createPlanningWeekAutosave, type PlannerWeekSaveStatus } from '~~/utils/planningAutosave'
import type { WeekPlanV1, WeekTemplatePatchInput } from '~~/types/planning'

/** Which server row backs the active week tab (drives PATCH URL and title semantics). */
export type WeekPlannerPersistenceKind = 'none' | 'saved-weekplan' | 'week-template'

/**
 * Debounced autosave for the weekly planner when a week row is linked (saved weekplan or legacy template).
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
    patch: (id, input: WeekTemplatePatchInput) => {
      const path =
        persistenceKind.value === 'saved-weekplan'
          ? `/api/v1/saved-weekplans/${id}`
          : `/api/v1/planning/week-templates/${id}`
      return $fetch(path, { method: 'PATCH', body: input })
    },
    onDirty: () => { saveStatus.value = 'dirty' },
    onSaving: () => { saveStatus.value = 'saving' },
    onSaved: () => { saveStatus.value = 'saved' },
    onError: () => { saveStatus.value = 'error' },
  })

  watch(weekPlan, () => ctrl.notifyWeekPlanChanged(), { deep: true })
  watch(weekPlanTitle, () => ctrl.notifyWeekPlanChanged())
  onBeforeUnmount(() => ctrl.cancel())
}
