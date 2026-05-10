import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { getSupabaseServerClient } from '../../../db/supabaseClient'
import {
  assertRecipeIdsExist,
  collectRecipeIdsFromWeekPlan,
} from '../../../services/planning/planningRepository'
import { withPlanningHandler } from '../../../services/planning/planningRequestContext'
import { updateSavedWeekplan } from '../../../services/planning/savedWeekplansRepository'
import { toPlanningHttpError } from '../../../utils/planningErrors'
import { weekTemplatePatchSchema } from '../../../../types/planning'

export default defineEventHandler(
  withPlanningHandler(
    { tag: 'saved-weekplans', operation: 'patch saved weekplan' },
    async (event, ctx) => {
      const id = getRouterParam(event, 'id')?.trim()
      if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Saved weekplan id is required.' })
      }

      const parsed = weekTemplatePatchSchema.safeParse(await readBody(event))
      if (!parsed.success) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid saved weekplan patch.', data: parsed.error.flatten() })
      }

      const supabase = getSupabaseServerClient()
      if (parsed.data.body) {
        const recipeCheck = await assertRecipeIdsExist(supabase, collectRecipeIdsFromWeekPlan(parsed.data.body))
        if (!recipeCheck.ok) {
          throw createError(toPlanningHttpError(recipeCheck.error))
        }
      }

      const result = await updateSavedWeekplan(supabase, id, ctx.principal, parsed.data)
      if (!result.ok) {
        throw createError(toPlanningHttpError(result.error))
      }

      ctx.logger.info('saved_weekplans.updated', {
        id: result.value.id,
        principalKind: ctx.principalKind,
      })

      return result.value
    },
  ),
)
