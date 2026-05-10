import { getSupabaseServerClient } from '../../../db/supabaseClient'
import { useTraceId } from '../../../middleware/01.trace-context'
import {
  principalKindForLog,
  resolvePlanningPrincipalFromEvent,
} from '../../../services/planning/planningPrincipal'
import { deleteSavedWeekplan } from '../../../services/planning/savedWeekplansRepository'
import { appLogger } from '../../../utils/logger'
import { handlePlanningUnexpected, toPlanningHttpError } from '../../../utils/planningErrors'
import { useStructuredLogger } from '../../../utils/structuredLogger'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')?.trim()
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Saved weekplan id is required.' })
    }

    const principal = await resolvePlanningPrincipalFromEvent(event)
    const result = await deleteSavedWeekplan(getSupabaseServerClient(), id, principal)
    if (!result.ok) {
      throw createError(toPlanningHttpError(result.error))
    }

    useStructuredLogger(appLogger.withTag('saved-weekplans'), useTraceId(event)).info('saved_weekplans.deleted', {
      id,
      principalKind: principalKindForLog(principal),
    })

    return result.value
  }
  catch (err) {
    handlePlanningUnexpected(err, 'saved-weekplans', 'delete saved weekplan')
  }
})
