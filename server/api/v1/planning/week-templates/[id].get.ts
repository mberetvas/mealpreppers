import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import { getWeekTemplateById } from '../../../../services/planning/planningRepository'
import { handlePlanningUnexpected } from '../../../../utils/planningErrors'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')?.trim()
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Template id is required.' })
    }

    const row = await getWeekTemplateById(getSupabaseServerClient(), id)
    if (!row) {
      throw createError({ statusCode: 404, statusMessage: 'Week template not found.' })
    }
    return row
  }
  catch (err) {
    handlePlanningUnexpected(err, 'planning-week-templates', 'get week template')
  }
})
