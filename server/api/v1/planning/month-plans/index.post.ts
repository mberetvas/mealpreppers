import { createError, defineEventHandler, readBody } from 'h3'
import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import { useTraceId } from '../../../../middleware/01.trace-context'
import {
  assertRecipeIdsExist,
  collectRecipeIdsFromMonthPlan,
  createMonthPlan,
} from '../../../../services/planning/planningRepository'
import { monthPlanCreateSchema } from '../../../../../types/planning'
import { handlePlanningUnexpected, toPlanningHttpError } from '../../../../utils/planningErrors'

export default defineEventHandler(async (event) => {
  try {
    const parsed = monthPlanCreateSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid month plan payload.', data: parsed.error.flatten() })
    }

    const supabase = getSupabaseServerClient()
    const recipeCheck = await assertRecipeIdsExist(supabase, collectRecipeIdsFromMonthPlan(parsed.data.body))
    if (!recipeCheck.ok) {
      throw createError(toPlanningHttpError(recipeCheck.error))
    }

    const result = await createMonthPlan(supabase, parsed.data)
    if (!result.ok) {
      throw createError(toPlanningHttpError(result.error))
    }

    return result.value
  }
  catch (err) {
    handlePlanningUnexpected(err, 'planning-month-plans', 'create month plan', useTraceId(event))
  }
})
