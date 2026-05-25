import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import { withPlanningHandler } from '../../../../services/planning/planningRequestContext'
import { consolidateShoppingList } from '../../../../services/shopping-list/consolidationService'
import { createShoppingListPolishChain, LangChainShoppingListPolishPort } from '../../../../services/shopping-list/polishChainFactory'

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

      // Build production polish port when API key is configured
      let polishPort = null
      if (openrouterApiKey) {
        const chain = createShoppingListPolishChain({
          openrouterApiKey,
          openrouterShoppingListModel: config.openrouterShoppingListModel,
          openrouterShoppingListTimeoutMs: config.openrouterShoppingListTimeoutMs,
          openrouterAppUrl: config.openrouterAppUrl,
          openrouterAppTitle: config.openrouterAppTitle,
          langsmithApiKey: config.langsmithApiKey,
        })
        if (chain) {
          polishPort = new LangChainShoppingListPolishPort(chain, ctx.logger)
        }
      }

      const result = await consolidateShoppingList(id, {
        supabaseClient: getSupabaseServerClient(),
        principal: ctx.principal,
        logger: ctx.logger,
        polishPort,
        openrouterApiKey,
      })

      return result
    },
  ),
)
