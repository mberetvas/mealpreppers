import { getSupabaseServerClient } from '../../../db/supabaseClient'
import { useTraceId } from '../../../middleware/01.trace-context'
import { readAnonymousPlanningSessionCookie } from '../../../services/planning/planningPrincipal'
import { resolveSupabaseUserIdFromBearer } from '../../../services/planning/planningSupabaseAuth'
import { countAnonymousSavedWeekplansForSession } from '../../../services/planning/savedWeekplansRepository'
import { handlePlanningUnexpected, toPlanningHttpError } from '../../../utils/planningErrors'

/** Returns how many anonymous Saved Weekplans are pending for this browser session while authenticated. */
export default defineEventHandler(async (event) => {
  try {
    const userId = await resolveSupabaseUserIdFromBearer(event)
    if (!userId) {
      throw createError({ statusCode: 401, statusMessage: 'Authentication required.' })
    }

    const sessionId = readAnonymousPlanningSessionCookie(event)
    if (!sessionId) {
      return { count: 0 }
    }

    const supabase = getSupabaseServerClient()
    const result = await countAnonymousSavedWeekplansForSession(supabase, sessionId)
    if (!result.ok) {
      throw createError(toPlanningHttpError(result.error))
    }

    return { count: result.value }
  }
  catch (err) {
    handlePlanningUnexpected(err, 'saved-weekplans', 'anonymous merge preview', useTraceId(event))
  }
})
