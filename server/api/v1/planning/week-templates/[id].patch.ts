import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import {
  assertRecipeIdsExist,
  collectRecipeIdsFromWeekPlan,
  updateWeekTemplate,
} from '../../../../services/planning/planningRepository'
import { weekTemplatePatchSchema } from '../../../../../types/planning'
import { handlePlanningUnexpected, toPlanningHttpError } from '../../../../utils/planningErrors'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')?.trim()
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Template id is required.' })
    }

    const parsed = weekTemplatePatchSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid week template patch.', data: parsed.error.flatten() })
    }

    const supabase = getSupabaseServerClient()
    if (parsed.data.body) {
      const recipeCheck = await assertRecipeIdsExist(supabase, collectRecipeIdsFromWeekPlan(parsed.data.body))
      if (!recipeCheck.ok) {
        throw createError(toPlanningHttpError(recipeCheck.error))
      }
    }

    const result = await updateWeekTemplate(supabase, id, parsed.data)
    if (!result.ok) {
      throw createError(toPlanningHttpError(result.error))
    }

    return result.value
  }
  catch (err) {
    handlePlanningUnexpected(err, 'planning-week-templates', 'patch week template')
  }
})
