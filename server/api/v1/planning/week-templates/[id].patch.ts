import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import {
  assertRecipeIdsExist,
  collectRecipeIdsFromWeekPlan,
  updateWeekTemplate,
} from '../../../../services/planning/planningRepository'
import { weekTemplatePatchSchema } from '../../../../../types/planning'
import { handlePlanningUnexpected } from '../../../../utils/planningErrors'

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
      await assertRecipeIdsExist(supabase, collectRecipeIdsFromWeekPlan(parsed.data.body))
    }
    return await updateWeekTemplate(supabase, id, parsed.data)
  }
  catch (err) {
    handlePlanningUnexpected(err, 'planning-week-templates', 'patch week template')
  }
})
