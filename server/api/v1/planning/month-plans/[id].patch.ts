import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import {
  assertRecipeIdsExist,
  collectRecipeIdsFromMonthPlan,
  updateMonthPlan,
} from '../../../../services/planning/planningRepository'
import { monthPlanPatchSchema } from '../../../../../types/planning'
import { handlePlanningUnexpected } from '../../../../utils/planningErrors'

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
      await assertRecipeIdsExist(supabase, collectRecipeIdsFromMonthPlan(parsed.data.body))
    }
    return await updateMonthPlan(supabase, id, parsed.data)
  }
  catch (err) {
    handlePlanningUnexpected(err, 'planning-month-plans', 'patch month plan')
  }
})
