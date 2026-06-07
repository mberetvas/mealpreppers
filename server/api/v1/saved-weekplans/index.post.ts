import { getDb } from '../../../db/sqlite'
import {
  assertRecipeIdsExist,
  collectRecipeIdsFromWeekPlan,
} from '../../../services/planning/planningRepository'
import { executeCreateSavedWeekplan } from '../../../services/planning/application/createSavedWeekplan'
import { createPlanningDeps } from '../../../services/planning/planningComposition'
import { withPlanningHandler } from '../../../services/planning/planningRequestContext'
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

      const db = getDb()
      const recipeCheck = await assertRecipeIdsExist(db, collectRecipeIdsFromWeekPlan(parsed.data.body))
      if (!recipeCheck.ok) {
        throw createError(toPlanningHttpError(recipeCheck.error))
      }

      const { createSavedWeekplanDeps } = createPlanningDeps(db)
      const result = executeCreateSavedWeekplan(createSavedWeekplanDeps, ctx.principal, parsed.data)
      if (!result.ok) {
        throw createError(toPlanningHttpError(result.error))
      }

      ctx.logger.info('saved_weekplans.created', {
        id: result.value.id,
        principalKind: ctx.principalKind,
        shoppingListCopiedFromMatch: result.value.shoppingListCopiedFromMatch,
      })

      return result.value
    },
  ),
)
