import { getSupabaseServerClient } from '../../../db/supabaseClient'
import { useTraceId } from '../../../middleware/01.trace-context'
import {
  principalKindForLog,
  resolvePlanningPrincipalFromEvent,
} from '../../../services/planning/planningPrincipal'
import {
  assertRecipeIdsExist,
  collectRecipeIdsFromWeekPlan,
} from '../../../services/planning/planningRepository'
import { createSavedWeekplan } from '../../../services/planning/savedWeekplansRepository'
import { appLogger } from '../../../utils/logger'
import { handlePlanningUnexpected, toPlanningHttpError } from '../../../utils/planningErrors'
import { useStructuredLogger } from '../../../utils/structuredLogger'
import { weekTemplateCreateSchema } from '../../../../types/planning'

export default defineEventHandler(async (event) => {
  try {
    const parsed = weekTemplateCreateSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid saved weekplan payload.', data: parsed.error.flatten() })
    }

    const principal = await resolvePlanningPrincipalFromEvent(event)
    const supabase = getSupabaseServerClient()
    const recipeCheck = await assertRecipeIdsExist(supabase, collectRecipeIdsFromWeekPlan(parsed.data.body))
    if (!recipeCheck.ok) {
      throw createError(toPlanningHttpError(recipeCheck.error))
    }

    const result = await createSavedWeekplan(supabase, principal, parsed.data)
    if (!result.ok) {
      throw createError(toPlanningHttpError(result.error))
    }

    useStructuredLogger(appLogger.withTag('saved-weekplans'), useTraceId(event)).info('saved_weekplans.created', {
      id: result.value.id,
      principalKind: principalKindForLog(principal),
    })

    return result.value
  }
  catch (err) {
    handlePlanningUnexpected(err, 'saved-weekplans', 'create saved weekplan')
  }
})
