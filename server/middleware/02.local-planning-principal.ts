import { defineEventHandler } from 'h3'
import { backfillLocalPrincipalOwnership, getLocalPlanningUserId } from '../services/planning/localPrincipal'

/** Injects the install-scoped local Planning Principal on every Nitro request. */
export default defineEventHandler((event) => {
  backfillLocalPrincipalOwnership()
  ;(event.context as Record<string, unknown>).planningUserId = getLocalPlanningUserId()
})
