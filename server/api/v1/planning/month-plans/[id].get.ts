import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import { getMonthPlanById } from '../../../../services/planning/planningRepository'
import { handlePlanningUnexpected } from '../../../../utils/planningErrors'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')?.trim()
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Month plan id is required.' })
    }

    const row = await getMonthPlanById(getSupabaseServerClient(), id)
    if (!row) {
      throw createError({ statusCode: 404, statusMessage: 'Month plan not found.' })
    }
    return row
  }
  catch (err) {
    handlePlanningUnexpected(err, 'planning-month-plans', 'get month plan')
  }
})
