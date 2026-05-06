import type { MonthPlanV1, WeekPlanV1 } from '~~/types/planning'

export type PlannerWeekSaveStatus = 'saved' | 'saving' | 'dirty' | 'error'

export interface PlanningWeekAutosaveController {
  /** Call when the week document changed (e.g. from a deep watch). */
  notifyWeekPlanChanged: () => void
  cancel: () => void
}

/**
 * Debounced PATCH for a linked week template; mirrors planner UX (dirty / saving / saved / error).
 */
export function createPlanningWeekAutosave(config: {
  debounceMs: number
  getTemplateId: () => string | null
  getWeekBody: () => WeekPlanV1
  patch: (templateId: string, body: WeekPlanV1) => Promise<void>
  onDirty: () => void
  onSaving: () => void
  onSaved: () => void
  onError: () => void
  setTimeoutFn?: typeof setTimeout
  clearTimeoutFn?: typeof clearTimeout
}): PlanningWeekAutosaveController {
  const setT = config.setTimeoutFn ?? setTimeout
  const clearT = config.clearTimeoutFn ?? clearTimeout
  let timer: ReturnType<typeof setTimeout> | undefined

  function notifyWeekPlanChanged() {
    const id = config.getTemplateId()
    if (!id) {
      clearT(timer)
      timer = undefined
      config.onDirty()
      return
    }
    config.onSaving()
    clearT(timer)
    timer = setT(async () => {
      try {
        await config.patch(id, config.getWeekBody())
        config.onSaved()
      }
      catch {
        config.onError()
      }
    }, config.debounceMs)
  }

  function cancel() {
    clearT(timer)
    timer = undefined
  }

  return { notifyWeekPlanChanged, cancel }
}

export interface PlanningMonthAutosaveController {
  notifyMonthPlanChanged: () => void
  cancel: () => void
}

/**
 * Debounced PATCH for the active month plan; errors are swallowed (local-only) like the planner page.
 */
export function createPlanningMonthAutosave(config: {
  debounceMs: number
  getMonthPlanId: () => string | null
  getBody: () => MonthPlanV1
  patch: (monthPlanId: string, body: MonthPlanV1) => Promise<void>
  setTimeoutFn?: typeof setTimeout
  clearTimeoutFn?: typeof clearTimeout
}): PlanningMonthAutosaveController {
  const setT = config.setTimeoutFn ?? setTimeout
  const clearT = config.clearTimeoutFn ?? clearTimeout
  let timer: ReturnType<typeof setTimeout> | undefined

  function notifyMonthPlanChanged() {
    const id = config.getMonthPlanId()
    if (!id) {
      return
    }
    clearT(timer)
    timer = setT(async () => {
      try {
        await config.patch(id, config.getBody())
      }
      catch {
        /* saved locally only until retry */
      }
    }, config.debounceMs)
  }

  function cancel() {
    clearT(timer)
    timer = undefined
  }

  return { notifyMonthPlanChanged, cancel }
}
