import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getSupabaseServerClient } from '../../../db/supabaseClient'
import { withPlanningHandler } from '../../../services/planning/planningRequestContext'
import { deleteSavedWeekplan } from '../../../services/planning/savedWeekplansRepository'
import { toPlanningHttpError } from '../../../utils/planningErrors'

export default defineEventHandler(
  withPlanningHandler(
    { tag: 'saved-weekplans', operation: 'delete saved weekplan' },
    async (event, ctx) => {
      const id = getRouterParam(event, 'id')?.trim()
      if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Saved weekplan id is required.' })
      }

      const result = await deleteSavedWeekplan(getSupabaseServerClient(), id, ctx.principal)
      if (!result.ok) {
        throw createError(toPlanningHttpError(result.error))
      }

      ctx.logger.info('saved_weekplans.deleted', {
        id,
        principalKind: ctx.principalKind,
      })

      return result.value
    },
  ),
)
