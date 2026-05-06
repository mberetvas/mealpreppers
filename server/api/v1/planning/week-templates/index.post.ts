import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import {
  assertRecipeIdsExist,
  collectRecipeIdsFromWeekPlan,
  createWeekTemplate,
} from '../../../../services/planning/planningRepository'
import { weekTemplateCreateSchema } from '../../../../../types/planning'
import { handlePlanningUnexpected, toPlanningHttpError } from '../../../../utils/planningErrors'

export default defineEventHandler(async (event) => {
  try {
    const parsed = weekTemplateCreateSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid week template payload.', data: parsed.error.flatten() })
    }

    const supabase = getSupabaseServerClient()
    const recipeCheck = await assertRecipeIdsExist(supabase, collectRecipeIdsFromWeekPlan(parsed.data.body))
    if (!recipeCheck.ok) {
      throw createError(toPlanningHttpError(recipeCheck.error))
    }

    const result = await createWeekTemplate(supabase, parsed.data)
    if (!result.ok) {
      throw createError(toPlanningHttpError(result.error))
    }

    return result.value
  }
  catch (err) {
    handlePlanningUnexpected(err, 'planning-week-templates', 'create week template')
  }
})
