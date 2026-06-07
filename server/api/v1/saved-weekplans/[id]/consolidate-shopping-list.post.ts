import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getDb } from '../../../../db/sqlite'
import { withPlanningHandler } from '../../../../services/planning/planningRequestContext'
import { getInstallSettings } from '../../../../services/settings/installSettingsRepository'
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
      const { openrouterShoppingListModel } = getInstallSettings(getDb())

      // Build production polish port when API key is configured
      let polishPort = null
      if (openrouterApiKey) {
        const chain = createShoppingListPolishChain({
          openrouterApiKey,
          openrouterShoppingListModel,
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
        principal: ctx.principal,
        logger: ctx.logger,
        polishPort,
        openrouterApiKey,
      })

      return result
    },
  ),
)
