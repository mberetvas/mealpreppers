import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import {
  assertRecipeIdsExist,
  collectRecipeIdsFromMonthPlan,
  createMonthPlan,
} from '../../../../services/planning/planningRepository'
import { monthPlanCreateSchema } from '../../../../../types/planning'
import { handlePlanningUnexpected } from '../../../../utils/planningErrors'

export default defineEventHandler(async (event) => {
  try {
    const parsed = monthPlanCreateSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid month plan payload.', data: parsed.error.flatten() })
    }

    const supabase = getSupabaseServerClient()
    await assertRecipeIdsExist(supabase, collectRecipeIdsFromMonthPlan(parsed.data.body))
    return await createMonthPlan(supabase, parsed.data)
  }
  catch (err) {
    handlePlanningUnexpected(err, 'planning-month-plans', 'create month plan')
  }
})
