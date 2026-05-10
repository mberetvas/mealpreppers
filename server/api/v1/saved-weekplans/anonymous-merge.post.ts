import { z } from 'zod'
import { getSupabaseServerClient } from '../../../db/supabaseClient'
import { useTraceId } from '../../../middleware/01.trace-context'
import { clearAnonymousPlanningSessionCookie, readAnonymousPlanningSessionCookie } from '../../../services/planning/planningPrincipal'
import { resolveSupabaseUserIdFromBearer } from '../../../services/planning/planningSupabaseAuth'
import {
  discardAnonymousSavedWeekplansForSession,
  mergeAnonymousSavedWeekplansToUser,
} from '../../../services/planning/savedWeekplansRepository'
import { appLogger } from '../../../utils/logger'
import { handlePlanningUnexpected, toPlanningHttpError } from '../../../utils/planningErrors'
import { useStructuredLogger } from '../../../utils/structuredLogger'

const anonymousMergeBodySchema = z.object({
  action: z.enum(['move', 'discard']),
})

/**
 * After login: move anonymous Saved Weekplans into the authenticated account, or delete them (no silent retention).
 */
export default defineEventHandler(async (event) => {
  try {
    const parsed = anonymousMergeBodySchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid payload.',
        data: parsed.error.flatten(),
      })
    }

    const userId = await resolveSupabaseUserIdFromBearer(event)
    if (!userId) {
      throw createError({ statusCode: 401, statusMessage: 'Authentication required.' })
    }

    const sessionId = readAnonymousPlanningSessionCookie(event)
    if (!sessionId) {
      clearAnonymousPlanningSessionCookie(event)
      return parsed.data.action === 'move' ? { moved: 0 } : { deleted: 0 }
    }

    const supabase = getSupabaseServerClient()
    const log = useStructuredLogger(appLogger.withTag('saved-weekplans'), useTraceId(event))

    if (parsed.data.action === 'move') {
      const result = await mergeAnonymousSavedWeekplansToUser(supabase, sessionId, userId)
      if (!result.ok) {
        throw createError(toPlanningHttpError(result.error))
      }
      log.info('saved_weekplans.anonymous_merged', { moved: result.value.moved })
      clearAnonymousPlanningSessionCookie(event)
      return { moved: result.value.moved }
    }

    const result = await discardAnonymousSavedWeekplansForSession(supabase, sessionId)
    if (!result.ok) {
      throw createError(toPlanningHttpError(result.error))
    }
    log.info('saved_weekplans.anonymous_discarded', { deleted: result.value.deleted })
    clearAnonymousPlanningSessionCookie(event)
    return { deleted: result.value.deleted }
  }
  catch (err) {
    handlePlanningUnexpected(err, 'saved-weekplans', 'anonymous merge')
  }
})
