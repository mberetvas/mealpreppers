import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import { listMonthPlans } from '../../../../services/planning/planningRepository'
import { handlePlanningUnexpected, toPlanningHttpError } from '../../../../utils/planningErrors'

export default defineEventHandler(async () => {
  try {
    const result = await listMonthPlans(getSupabaseServerClient())
    if (!result.ok) {
      throw createError(toPlanningHttpError(result.error))
    }
    return result.value
  }
  catch (err) {
    handlePlanningUnexpected(err, 'planning-month-plans', 'list month plans')
  }
})
