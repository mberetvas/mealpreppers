import { getSupabaseServerClient } from '../../../db/supabaseClient'
import {
  assertRecipeIdsExist,
  collectRecipeIdsFromWeekPlan,
} from '../../../services/planning/planningRepository'
import { withPlanningHandler } from '../../../services/planning/planningRequestContext'
import { createSavedWeekplan } from '../../../services/planning/savedWeekplansRepository'
import { toPlanningHttpError } from '../../../utils/planningErrors'
import { weekTemplateCreateSchema } from '../../../../types/planning'

export default defineEventHandler(
  withPlanningHandler(
    { tag: 'saved-weekplans', operation: 'create saved weekplan' },
    async (event, ctx) => {
      const parsed = weekTemplateCreateSchema.safeParse(await readBody(event))
      if (!parsed.success) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid saved weekplan payload.', data: parsed.error.flatten() })
      }

      const supabase = getSupabaseServerClient()
      const recipeCheck = await assertRecipeIdsExist(supabase, collectRecipeIdsFromWeekPlan(parsed.data.body))
      if (!recipeCheck.ok) {
        throw createError(toPlanningHttpError(recipeCheck.error))
      }

      const result = await createSavedWeekplan(supabase, ctx.principal, parsed.data)
      if (!result.ok) {
        throw createError(toPlanningHttpError(result.error))
      }

      ctx.logger.info('saved_weekplans.created', {
        id: result.value.id,
        principalKind: ctx.principalKind,
      })

      return result.value
    },
  ),
)
