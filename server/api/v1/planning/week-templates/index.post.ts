/** Legacy `POST /api/v1/planning/week-templates` — staged deprecation; prefer Saved Weekplans routes. See `./DEPRECATED.md`. */
import { createError, defineEventHandler, readBody } from 'h3'
import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import {
  assertRecipeIdsExist,
  collectRecipeIdsFromWeekPlan,
  createWeekTemplate,
} from '../../../../services/planning/planningRepository'
import { withPlanningHandler } from '../../../../services/planning/planningRequestContext'
import { weekTemplateCreateSchema } from '../../../../../types/planning'
import { toPlanningHttpError } from '../../../../utils/planningErrors'

export default defineEventHandler(
  withPlanningHandler(
    { tag: 'planning-week-templates', operation: 'create week template' },
    async (event, _ctx) => {
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
    },
  ),
)
