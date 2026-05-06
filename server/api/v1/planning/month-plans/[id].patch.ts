import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import {
  assertRecipeIdsExist,
  collectRecipeIdsFromMonthPlan,
  updateMonthPlan,
} from '../../../../services/planning/planningRepository'
import { monthPlanPatchSchema } from '../../../../../types/planning'
import { handlePlanningUnexpected, toPlanningHttpError } from '../../../../utils/planningErrors'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')?.trim()
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Month plan id is required.' })
    }

    const parsed = monthPlanPatchSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid month plan patch.', data: parsed.error.flatten() })
    }

    const supabase = getSupabaseServerClient()
    if (parsed.data.body) {
      const recipeCheck = await assertRecipeIdsExist(supabase, collectRecipeIdsFromMonthPlan(parsed.data.body))
      if (!recipeCheck.ok) {
        throw createError(toPlanningHttpError(recipeCheck.error))
      }
    }

    const result = await updateMonthPlan(supabase, id, parsed.data)
    if (!result.ok) {
      throw createError(toPlanningHttpError(result.error))
    }

    return result.value
  }
  catch (err) {
    handlePlanningUnexpected(err, 'planning-month-plans', 'patch month plan')
  }
})
