export type RecipeFailure =
  | {
    kind: 'storage_error'
    message: string
  }
  | {
    kind: 'not_found'
    message: string
  }

export type RecipeResult<T> =
  | { ok: true, value: T }
  | { ok: false, error: RecipeFailure }

/** Wraps a successful recipe repository outcome. */
export function recipeOk<T>(value: T): RecipeResult<T> {
  return { ok: true, value }
}

/** Wraps a failed recipe repository outcome. */
export function recipeFail<T>(error: RecipeFailure): RecipeResult<T> {
  return { ok: false, error }
}
