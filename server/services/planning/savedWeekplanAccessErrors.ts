import type { PlanningFailure } from './planningResult'
import type { SavedWeekplanAccessInterpretation } from './savedWeekplanAccess'

export function savedWeekplanNotFound(): PlanningFailure {
  return {
    kind: 'not_found',
    entity: 'saved_weekplan',
    message: 'Saved weekplan not found.',
  }
}

export function savedWeekplanForbidden(): PlanningFailure {
  return {
    kind: 'forbidden',
    entity: 'saved_weekplan',
    message: 'You do not have access to this saved weekplan.',
  }
}

export function accessInterpretationFailure(
  interpretation: SavedWeekplanAccessInterpretation,
): PlanningFailure | null {
  if (interpretation === 'legacy_unowned') {
    return savedWeekplanNotFound()
  }
  if (interpretation === 'wrong_owner') {
    return savedWeekplanForbidden()
  }
  return null
}
