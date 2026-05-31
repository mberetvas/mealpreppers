import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getDb } from '../../../../db/sqlite'
import { useTraceId } from '../../../../middleware/01.trace-context'
import { deleteMonthPlan } from '../../../../services/planning/planningRepository'
import { handlePlanningUnexpected, toPlanningHttpError } from '../../../../utils/planningErrors'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')?.trim()
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Month plan id is required.' })
    }

    const result = await deleteMonthPlan(getDb(), id)
    if (!result.ok) {
      throw createError(toPlanningHttpError(result.error))
    }
    return result.value
  }
  catch (err) {
    handlePlanningUnexpected(err, 'planning-month-plans', 'delete month plan', useTraceId(event))
  }
})
