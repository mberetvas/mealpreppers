/** Preferred list endpoint for persisted week grids (principal-scoped). Replaces deprecated `GET .../planning/week-templates`. */
import { getSupabaseServerClient } from '../../../db/supabaseClient'
import { resolvePlanningPrincipalFromEvent } from '../../../services/planning/planningPrincipal'
import { listSavedWeekplans } from '../../../services/planning/savedWeekplansRepository'
import { handlePlanningUnexpected, toPlanningHttpError } from '../../../utils/planningErrors'

export default defineEventHandler(async (event) => {
  try {
    const principal = await resolvePlanningPrincipalFromEvent(event)
    const result = await listSavedWeekplans(getSupabaseServerClient(), principal)
    if (!result.ok) {
      throw createError(toPlanningHttpError(result.error))
    }
    return result.value
  }
  catch (err) {
    handlePlanningUnexpected(err, 'saved-weekplans', 'list saved weekplans')
  }
})
