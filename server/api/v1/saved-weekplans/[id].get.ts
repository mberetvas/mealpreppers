import { getSupabaseServerClient } from '../../../db/supabaseClient'
import { useTraceId } from '../../../middleware/01.trace-context'
import { resolvePlanningPrincipalFromEvent } from '../../../services/planning/planningPrincipal'
import { getSavedWeekplanById } from '../../../services/planning/savedWeekplansRepository'
import { handlePlanningUnexpected, toPlanningHttpError } from '../../../utils/planningErrors'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')?.trim()
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Saved weekplan id is required.' })
    }

    const principal = await resolvePlanningPrincipalFromEvent(event)
    const result = await getSavedWeekplanById(getSupabaseServerClient(), id, principal)
    if (!result.ok) {
      throw createError(toPlanningHttpError(result.error))
    }
    return result.value
  }
  catch (err) {
    handlePlanningUnexpected(err, 'saved-weekplans', 'get saved weekplan')
  }
})
