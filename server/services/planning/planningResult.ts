export type PlanningFailure =
  | {
    kind: 'storage_error'
    message: string
  }
  | {
    kind: 'not_found'
    entity: 'week_template' | 'month_plan' | 'saved_weekplan'
    message: string
  }
  | {
    kind: 'forbidden'
    entity: 'saved_weekplan'
    message: string
  }
  | {
    kind: 'invalid_recipe_ids'
    missingRecipeIds: string[]
    message: string
  }
  | {
    kind: 'deprecated_list'
    message: string
  }

export type PlanningResult<T> =
  | {
    ok: true
    value: T
  }
  | {
    ok: false
    error: PlanningFailure
  }

export function ok<T>(value: T): PlanningResult<T> {
  return { ok: true, value }
}

export function fail<T>(error: PlanningFailure): PlanningResult<T> {
  return { ok: false, error }
}
