import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import { deleteMonthPlan } from '../../../../services/planning/planningRepository'
import { handlePlanningUnexpected } from '../../../../utils/planningErrors'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')?.trim()
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Month plan id is required.' })
    }

    const removed = await deleteMonthPlan(getSupabaseServerClient(), id)
    if (!removed) {
      throw createError({ statusCode: 404, statusMessage: 'Month plan not found.' })
    }
    return { ok: true as const }
  }
  catch (err) {
    handlePlanningUnexpected(err, 'planning-month-plans', 'delete month plan')
  }
})
