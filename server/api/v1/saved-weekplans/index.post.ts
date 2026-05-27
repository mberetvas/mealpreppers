import { getSupabaseServerClient } from '../../../db/supabaseClient'
import {
  assertRecipeIdsExist,
  collectRecipeIdsFromWeekPlan,
} from '../../../services/planning/planningRepository'
import { withPlanningHandler } from '../../../services/planning/planningRequestContext'
import { createSavedWeekplan } from '../../../services/planning/savedWeekplansRepository'
import { copyConsolidatedListFromMatchingPlan } from '../../../services/shopping-list/consolidatedShoppingListRepository'
import { computeSourceFingerprint } from '../../../services/shopping-list/sourceFingerprint'
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

      // Copy-on-match: if an existing confirmed list for this principal shares the same
      // fingerprint, copy it immediately. The flag is returned on this response exactly once
      // so the client can show a copy notice without an extra round-trip.
      const fingerprint = computeSourceFingerprint(parsed.data.body)
      const copyResult = await copyConsolidatedListFromMatchingPlan(supabase, result.value.id, ctx.principal, fingerprint)
      const shoppingListCopiedFromMatch = copyResult.ok && copyResult.value.copied

      ctx.logger.info('saved_weekplans.created', {
        id: result.value.id,
        principalKind: ctx.principalKind,
        shoppingListCopiedFromMatch,
      })

      return { ...result.value, shoppingListCopiedFromMatch }
    },
  ),
)
