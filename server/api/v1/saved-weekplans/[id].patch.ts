import { getSupabaseServerClient } from '../../../db/supabaseClient'
import { useTraceId } from '../../../middleware/01.trace-context'
import {
  principalKindForLog,
  resolvePlanningPrincipal,
} from '../../../services/planning/planningPrincipal'
import {
  assertRecipeIdsExist,
  collectRecipeIdsFromWeekPlan,
} from '../../../services/planning/planningRepository'
import { updateSavedWeekplan } from '../../../services/planning/savedWeekplansRepository'
import { appLogger } from '../../../utils/logger'
import { handlePlanningUnexpected, toPlanningHttpError } from '../../../utils/planningErrors'
import { useStructuredLogger } from '../../../utils/structuredLogger'
import { weekTemplatePatchSchema } from '../../../../types/planning'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')?.trim()
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Saved weekplan id is required.' })
    }

    const parsed = weekTemplatePatchSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid saved weekplan patch.', data: parsed.error.flatten() })
    }

    const principal = resolvePlanningPrincipal(event)
    const supabase = getSupabaseServerClient()
    if (parsed.data.body) {
      const recipeCheck = await assertRecipeIdsExist(supabase, collectRecipeIdsFromWeekPlan(parsed.data.body))
      if (!recipeCheck.ok) {
        throw createError(toPlanningHttpError(recipeCheck.error))
      }
    }

    const result = await updateSavedWeekplan(supabase, id, principal, parsed.data)
    if (!result.ok) {
      throw createError(toPlanningHttpError(result.error))
    }

    useStructuredLogger(appLogger.withTag('saved-weekplans'), useTraceId(event)).info('saved_weekplans.updated', {
      id: result.value.id,
      principalKind: principalKindForLog(principal),
    })

    return result.value
  }
  catch (err) {
    handlePlanningUnexpected(err, 'saved-weekplans', 'patch saved weekplan')
  }
})
