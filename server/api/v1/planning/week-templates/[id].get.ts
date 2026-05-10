/** Legacy `GET /api/v1/planning/week-templates/:id` — staged deprecation; prefer Saved Weekplans routes. See `./DEPRECATED.md`. */
import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import { getWeekTemplateById } from '../../../../services/planning/planningRepository'
import { handlePlanningUnexpected, toPlanningHttpError } from '../../../../utils/planningErrors'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')?.trim()
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Template id is required.' })
    }

    const result = await getWeekTemplateById(getSupabaseServerClient(), id)
    if (!result.ok) {
      throw createError(toPlanningHttpError(result.error))
    }
    return result.value
  }
  catch (err) {
    handlePlanningUnexpected(err, 'planning-week-templates', 'get week template')
  }
})
