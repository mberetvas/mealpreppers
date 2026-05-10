/** Legacy `GET /api/v1/planning/week-templates` — staged deprecation; prefer Saved Weekplans routes. See `./DEPRECATED.md`. */
import { createError, defineEventHandler } from 'h3'
import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import { listWeekTemplates } from '../../../../services/planning/planningRepository'
import { withPlanningHandler } from '../../../../services/planning/planningRequestContext'
import { toPlanningHttpError } from '../../../../utils/planningErrors'

export default defineEventHandler(
  withPlanningHandler(
    { tag: 'planning-week-templates', operation: 'list week templates' },
    async (_event, _ctx) => {
      const result = await listWeekTemplates(getSupabaseServerClient())
      if (!result.ok) {
        throw createError(toPlanningHttpError(result.error))
      }
      return result.value
    },
  ),
)
