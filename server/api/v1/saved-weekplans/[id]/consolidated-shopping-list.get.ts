import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getDb } from '../../../../db/sqlite'
import { withPlanningHandler } from '../../../../services/planning/planningRequestContext'
import { getConsolidatedShoppingList } from '../../../../services/shopping-list/consolidatedShoppingListRepository'
import { toPlanningHttpError } from '../../../../utils/planningErrors'

export default defineEventHandler(
  withPlanningHandler(
    { tag: 'shopping-list', operation: 'get consolidated shopping list' },
    async (event, ctx) => {
      const id = getRouterParam(event, 'id')?.trim()
      if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Saved weekplan id is required.' })
      }

      const result = await getConsolidatedShoppingList(getDb(), id, ctx.principal)
      if (!result.ok) {
        throw createError(toPlanningHttpError(result.error))
      }

      if (result.value === null) {
        throw createError({ statusCode: 404, statusMessage: 'No saved consolidated shopping list found.' })
      }

      return result.value
    },
  ),
)
