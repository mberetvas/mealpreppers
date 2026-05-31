import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { getDb } from '../../../../db/sqlite'
import { withPlanningHandler } from '../../../../services/planning/planningRequestContext'
import { saveConsolidatedShoppingList, validateConsolidatedShoppingListInput } from '../../../../services/shopping-list/consolidatedShoppingListRepository'
import { toPlanningHttpError } from '../../../../utils/planningErrors'

export default defineEventHandler(
  withPlanningHandler(
    { tag: 'shopping-list', operation: 'save consolidated shopping list' },
    async (event, ctx) => {
      const id = getRouterParam(event, 'id')?.trim()
      if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Saved weekplan id is required.' })
      }

      const body = await readBody(event)
      const validation = validateConsolidatedShoppingListInput(body)
      if (!validation.valid) {
        throw createError({ statusCode: 400, statusMessage: validation.error ?? 'Invalid request body.' })
      }

      const result = await saveConsolidatedShoppingList(
        getDb(),
        id,
        ctx.principal,
        validation.lines!,
      )

      if (!result.ok) {
        throw createError(toPlanningHttpError(result.error))
      }

      return result.value
    },
  ),
)
