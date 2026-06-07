import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getDb } from '../../../db/sqlite'
import { createPlanningDeps } from '../../../services/planning/planningComposition'
import { withPlanningHandler } from '../../../services/planning/planningRequestContext'
import { getSavedWeekplanWithShoppingListFlags } from '../../../services/planning/savedWeekplansRepository'
import { toPlanningHttpError } from '../../../utils/planningErrors'

export default defineEventHandler(
  withPlanningHandler(
    { tag: 'saved-weekplans', operation: 'get saved weekplan' },
    async (event, ctx) => {
      const id = getRouterParam(event, 'id')?.trim()
      if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Saved weekplan id is required.' })
      }

      const db = getDb()
      const { savedWeekplanReader } = createPlanningDeps(db)
      const result = await getSavedWeekplanWithShoppingListFlags(db, id, ctx.principal, savedWeekplanReader)
      if (!result.ok) {
        throw createError(toPlanningHttpError(result.error))
      }
      return result.value
    },
  ),
)
