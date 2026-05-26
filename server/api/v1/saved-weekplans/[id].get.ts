import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getSupabaseServerClient } from '../../../db/supabaseClient'
import { withPlanningHandler } from '../../../services/planning/planningRequestContext'
import { getSavedWeekplanWithShoppingListFlags } from '../../../services/planning/savedWeekplansRepository'
import { toPlanningHttpError } from '../../../utils/planningErrors'

export default defineEventHandler(
  withPlanningHandler(
    { tag: 'saved-weekplans', operation: 'get saved weekplan' },
    async (event, ctx) => {
      const id = getRouterParam(event, 'id')?.trim()
      if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Saved weekplan id is required.' })
      }

      const result = await getSavedWeekplanWithShoppingListFlags(getSupabaseServerClient(), id, ctx.principal)
      if (!result.ok) {
        throw createError(toPlanningHttpError(result.error))
      }
      return result.value
    },
  ),
)
