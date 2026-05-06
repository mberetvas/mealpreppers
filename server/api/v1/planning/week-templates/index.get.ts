import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import { listWeekTemplates } from '../../../../services/planning/planningRepository'
import { handlePlanningUnexpected, toPlanningHttpError } from '../../../../utils/planningErrors'

export default defineEventHandler(async () => {
  try {
    const result = await listWeekTemplates(getSupabaseServerClient())
    if (!result.ok) {
      throw createError(toPlanningHttpError(result.error))
    }
    return result.value
  }
  catch (err) {
    handlePlanningUnexpected(err, 'planning-week-templates', 'list week templates')
  }
})
