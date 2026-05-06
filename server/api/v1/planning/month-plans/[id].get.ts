import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import { getMonthPlanById } from '../../../../services/planning/planningRepository'
import { handlePlanningUnexpected, toPlanningHttpError } from '../../../../utils/planningErrors'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')?.trim()
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Month plan id is required.' })
    }

    const result = await getMonthPlanById(getSupabaseServerClient(), id)
    if (!result.ok) {
      throw createError(toPlanningHttpError(result.error))
    }
    return result.value
  }
  catch (err) {
    handlePlanningUnexpected(err, 'planning-month-plans', 'get month plan')
  }
})
