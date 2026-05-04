import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import { listWeekTemplates } from '../../../../services/planning/planningRepository'
import { handlePlanningUnexpected } from '../../../../utils/planningErrors'

export default defineEventHandler(async () => {
  try {
    return await listWeekTemplates(getSupabaseServerClient())
  }
  catch (err) {
    handlePlanningUnexpected(err, 'planning-week-templates', 'list week templates')
  }
})
