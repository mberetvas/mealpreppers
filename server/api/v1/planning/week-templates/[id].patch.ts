/** Legacy `PATCH /api/v1/planning/week-templates/:id` — staged deprecation; prefer Saved Weekplans routes. See `./DEPRECATED.md`. */
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import {
  assertRecipeIdsExist,
  collectRecipeIdsFromWeekPlan,
  updateWeekTemplate,
} from '../../../../services/planning/planningRepository'
import { withPlanningHandler } from '../../../../services/planning/planningRequestContext'
import { weekTemplatePatchSchema } from '../../../../../types/planning'
import { toPlanningHttpError } from '../../../../utils/planningErrors'

export default defineEventHandler(
  withPlanningHandler(
    { tag: 'planning-week-templates', operation: 'patch week template' },
    async (event, _ctx) => {
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
    },
  ),
)
