import type { SupabaseClient } from '@supabase/supabase-js'
import type { StructuredLogger } from '../../utils/structuredLogger'
import type { PlanningPrincipal } from '../planning/planningPrincipal'
import type { MergedLine } from './exactMerge'
import type { PolishResponseChange } from './polishHarness'
import type { ShoppingListPolishPort } from './polishPort'
import { getSavedWeekplanById } from '../planning/savedWeekplansRepository'
import { toPlanningHttpError } from '../../utils/planningErrors'
import { collectRecipeOccurrences, buildShoppingList } from '../../../utils/shoppingList'
import { exactMerge, buildPolishContext } from './exactMerge'
import { listRecipes } from '../recipe-catalog/recipeRepository'
import type { RecipeCatalogItem } from '../../../types/recipe-catalog-item'
import { createError } from 'h3'

export type PolishStatus = 'ai_skipped' | 'ai_applied' | 'ai_failed'

export interface ConsolidationResult {
  consolidatedLines: MergedLine[]
  baselineLines: MergedLine[]
  changes: PolishResponseChange[]
  polishStatus: PolishStatus
  warnings: string[]
}

export interface ConsolidationDeps {
  supabaseClient: SupabaseClient
  principal: PlanningPrincipal
  logger: StructuredLogger
  polishPort: ShoppingListPolishPort | null
  openrouterApiKey: string | undefined
}

/**
 * Orchestrates shopping list consolidation: load plan → resolve catalog recipes →
 * build scaled ingredients → exact merge → delegate to polish port → return bundle.
 * When OPENROUTER_API_KEY is unset, skips AI polish and returns baseline as consolidated.
 */
export async function consolidateShoppingList(
  planId: string,
  deps: ConsolidationDeps,
): Promise<ConsolidationResult> {
  const startTime = Date.now()
  const { supabaseClient, principal, logger, polishPort, openrouterApiKey } = deps

  logger.info('shopping_list.consolidate_start', { planId })

  // Load the saved weekplan
  const planResult = await getSavedWeekplanById(supabaseClient, planId, principal)
  if (!planResult.ok) {
    throw createError(toPlanningHttpError(planResult.error))
  }

  const plan = planResult.value

  // Collect recipe occurrences from the plan body
  const occurrences = collectRecipeOccurrences(plan.body)

  // Resolve catalog recipes
  const recipesResult = await listRecipes(supabaseClient)
  if (!recipesResult.ok) {
    throw createError({ statusCode: 500, statusMessage: 'Recipes could not be loaded for consolidation.' })
  }

  const recipeMap = new Map<string, RecipeCatalogItem>(
    recipesResult.value.map(r => [r.id, r]),
  )

  // Build scaled ingredient sections (day ascending, breakfast → lunch → dinner order is preserved by collectRecipeOccurrences)
  const sections = buildShoppingList(occurrences, recipeMap)

  // Exact merge
  const baseline = exactMerge(sections)
  const baselineLines = baseline.lines

  // Polish port delegation
  const warnings: string[] = []
  let consolidatedLines = baselineLines
  let changes: PolishResponseChange[] = []
  let polishStatus: PolishStatus = 'ai_skipped'

  if (!openrouterApiKey) {
    logger.info('shopping_list.polish_skipped', { reason: 'missing_api_key' })
    warnings.push('AI polish was skipped because the API key is not configured.')
    polishStatus = 'ai_skipped'
  }
  else if (!polishPort) {
    logger.info('shopping_list.polish_skipped', { reason: 'no_polish_port' })
    warnings.push('AI polish was skipped because no polish implementation is available.')
    polishStatus = 'ai_skipped'
  }
  else {
    try {
      const polishContext = buildPolishContext(baseline)
      const result = await polishPort.polish(polishContext)
      consolidatedLines = result.response.lines.map((line, idx) => {
        const baselineLine = baselineLines.find(bl => bl.id === line.id)
        return {
          id: line.id,
          name: line.name,
          quantity: line.quantity,
          unit: line.unit,
          provenance: baselineLine?.provenance ?? [],
        }
      })
      changes = result.response.changes ?? []
      polishStatus = 'ai_applied'
    }
    catch {
      logger.warn('shopping_list.polish_failed', { planId })
      warnings.push('AI polish failed; returning baseline.')
      polishStatus = 'ai_failed'
      consolidatedLines = baselineLines
    }
  }

  const latencyMs = Date.now() - startTime
  logger.info('shopping_list.consolidate_complete', {
    planId,
    latencyMs,
    baselineLineCount: baselineLines.length,
    consolidatedLineCount: consolidatedLines.length,
    polishStatus,
  })

  return { consolidatedLines, baselineLines, changes, polishStatus, warnings }
}
