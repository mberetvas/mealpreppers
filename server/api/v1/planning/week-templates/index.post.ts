import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import {
  assertRecipeIdsExist,
  collectRecipeIdsFromWeekPlan,
  createWeekTemplate,
} from '../../../../services/planning/planningRepository'
import { weekTemplateCreateSchema } from '../../../../../types/planning'
import { handlePlanningUnexpected } from '../../../../utils/planningErrors'

export default defineEventHandler(async (event) => {
  try {
    const parsed = weekTemplateCreateSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid week template payload.', data: parsed.error.flatten() })
    }

    const supabase = getSupabaseServerClient()
    await assertRecipeIdsExist(supabase, collectRecipeIdsFromWeekPlan(parsed.data.body))
    return await createWeekTemplate(supabase, parsed.data)
  }
  catch (err) {
    handlePlanningUnexpected(err, 'planning-week-templates', 'create week template')
  }
})
