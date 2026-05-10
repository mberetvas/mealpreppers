/** Legacy `DELETE /api/v1/planning/week-templates/:id` — staged deprecation; prefer Saved Weekplans routes. See `./DEPRECATED.md`. */
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import { deleteWeekTemplate } from '../../../../services/planning/planningRepository'
import { withPlanningHandler } from '../../../../services/planning/planningRequestContext'
import { toPlanningHttpError } from '../../../../utils/planningErrors'

export default defineEventHandler(
  withPlanningHandler(
    { tag: 'planning-week-templates', operation: 'delete week template' },
    async (event, _ctx) => {
      const id = getRouterParam(event, 'id')?.trim()
      if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Template id is required.' })
      }

      const result = await deleteWeekTemplate(getSupabaseServerClient(), id)
      if (!result.ok) {
        throw createError(toPlanningHttpError(result.error))
      }
      return result.value
    },
  ),
)
