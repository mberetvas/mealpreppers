import { defineEventHandler } from 'h3'
import { backfillLocalPrincipalOwnership, getLocalPlanningUserId } from '../services/planning/localPrincipal'
import { isStaticDesktopClientBuild } from '../utils/staticDesktopClientBuild'

/** Injects the install-scoped local Planning Principal on every request. */
export default defineEventHandler((event) => {
  if (isStaticDesktopClientBuild()) {
    return
  }

  backfillLocalPrincipalOwnership()
  ;(event.context as Record<string, unknown>).planningUserId = getLocalPlanningUserId()
})
