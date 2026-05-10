/** Preferred list endpoint for persisted week grids (principal-scoped). Replaces deprecated `GET .../planning/week-templates`. */
import { createError, defineEventHandler } from 'h3'
import { getSupabaseServerClient } from '../../../db/supabaseClient'
import { withPlanningHandler } from '../../../services/planning/planningRequestContext'
import { listSavedWeekplans } from '../../../services/planning/savedWeekplansRepository'
import { toPlanningHttpError } from '../../../utils/planningErrors'

export default defineEventHandler(
  withPlanningHandler(
    { tag: 'saved-weekplans', operation: 'list saved weekplans' },
    async (_event, ctx) => {
      const result = await listSavedWeekplans(getSupabaseServerClient(), ctx.principal)
      if (!result.ok) {
        throw createError(toPlanningHttpError(result.error))
      }
      return result.value
    },
  ),
)
