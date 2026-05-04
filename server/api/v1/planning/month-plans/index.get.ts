import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import { listMonthPlans } from '../../../../services/planning/planningRepository'
import { handlePlanningUnexpected } from '../../../../utils/planningErrors'

export default defineEventHandler(async () => {
  try {
    return await listMonthPlans(getSupabaseServerClient())
  }
  catch (err) {
    handlePlanningUnexpected(err, 'planning-month-plans', 'list month plans')
  }
})
