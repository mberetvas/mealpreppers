import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import { withPlanningHandler } from '../../../../services/planning/planningRequestContext'
import { consolidateShoppingList } from '../../../../services/shopping-list/consolidationService'

export default defineEventHandler(
  withPlanningHandler(
    { tag: 'shopping-list', operation: 'consolidate shopping list' },
    async (event, ctx) => {
      const id = getRouterParam(event, 'id')?.trim()
      if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Saved weekplan id is required.' })
      }

      const config = useRuntimeConfig()
      const openrouterApiKey = config.openrouterApiKey || undefined

      const result = await consolidateShoppingList(id, {
        supabaseClient: getSupabaseServerClient(),
        principal: ctx.principal,
        logger: ctx.logger,
        polishPort: null,
        openrouterApiKey,
      })

      return result
    },
  ),
)
