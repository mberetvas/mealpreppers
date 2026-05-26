import type { SupabaseClient } from '@supabase/supabase-js'
import type { StructuredLogger } from '../../utils/structuredLogger'
import type { PlanningPrincipal } from '../planning/planningPrincipal'
import type { MergedLine } from './exactMerge'
import type { PolishResponse, PolishResponseChange } from './polishHarness'
import type { ShoppingListPolishPort } from './polishPort'
import type { PolishHint } from './polishHintBuilder'
import { getSavedWeekplanById } from '../planning/savedWeekplansRepository'
import { toPlanningHttpError } from '../../utils/planningErrors'
import { collectRecipeOccurrences, buildShoppingList } from '../../../utils/shoppingList'
import { exactMerge, buildPolishContext } from './exactMerge'
import { canonicalizePolishResponse, validatePolishResponse } from './polishHarness'
import { buildPolishHints } from './polishHintBuilder'
import { computeSourceFingerprint } from './sourceFingerprint'
import { isPolishAbortTimeout } from './polishChainFactory'
import { listRecipes } from '../recipe-catalog/recipeRepository'
import type { RecipeCatalogItem } from '../../../types/recipe-catalog-item'
import { createError } from 'h3'

export type PolishStatus = 'ai_skipped' | 'polished' | 'pending_review' | 'baseline_fallback'

export interface ConsolidationResult {
  consolidatedLines: MergedLine[]
  baselineLines: MergedLine[]
  changes: PolishResponseChange[]
  polishStatus: PolishStatus
  warnings: string[]
  polishResponse?: PolishResponse
  hints?: PolishHint[]
  sourceFingerprint?: string
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

  // Early return: empty plan (no recipe slots filled)
  if (occurrences.size === 0) {
    logger.info('shopping_list.empty_plan', { planId })
    return {
      consolidatedLines: [],
      baselineLines: [],
      changes: [],
      polishStatus: 'ai_skipped' as PolishStatus,
      warnings: ['This plan has no recipes yet. Add recipes to generate a shopping list.'],
    }
  }

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

  // Detect recipe resolution failures
  const resolvedCount = sections.length
  const totalRequested = occurrences.size
  const missingCount = totalRequested - resolvedCount

  // Total recipe resolution failure: all referenced recipes missing from catalog
  if (resolvedCount === 0) {
    logger.warn('shopping_list.total_recipe_resolution_failure', { planId, totalRequested })
    return {
      consolidatedLines: [],
      baselineLines: [],
      changes: [],
      polishStatus: 'ai_skipped' as PolishStatus,
      warnings: ['Could not load any recipes for this plan. The shopping list cannot be consolidated.'],
    }
  }

  // Exact merge
  const baseline = exactMerge(sections)
  const baselineLines = baseline.lines

  // Polish port delegation
  const warnings: string[] = []
  let consolidatedLines = baselineLines
  let changes: PolishResponseChange[] = []
  let polishStatus: PolishStatus = 'ai_skipped'
  let polishResponse: PolishResponse | undefined
  let hints: PolishHint[] | undefined
  const sourceFingerprint = computeSourceFingerprint(plan.body)

  // Partial recipe resolution: some recipes missing from catalog
  if (missingCount > 0) {
    logger.warn('shopping_list.partial_recipe_resolution', { planId, missingCount, totalRequested, resolvedCount })
    warnings.push(`${missingCount} recipe(s) could not be loaded — this list may be incomplete.`)
  }

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

      // Canonicalize and validate
      const canonicalized = canonicalizePolishResponse(result.response, baseline)
      const validation = validatePolishResponse(canonicalized, baseline)
      const polishHints = buildPolishHints(result.response, baseline)

      if (validation.valid) {
        // Clean pass: apply polished lines directly
        const baselineById = new Map(baselineLines.map(bl => [bl.id, bl]))
        consolidatedLines = canonicalized.lines.map((line) => {
          const baselineLine = baselineById.get(line.id)
          return {
            id: line.id,
            name: line.name,
            quantity: line.quantity,
            unit: line.unit,
            provenance: baselineLine?.provenance ?? [],
          }
        })
        changes = canonicalized.changes ?? []
        polishStatus = 'polished'
      }
      else {
        // Model succeeded but harness found violations → pending_review with hints
        const baselineById = new Map(baselineLines.map(bl => [bl.id, bl]))
        consolidatedLines = canonicalized.lines.map((line) => {
          const baselineLine = baselineById.get(line.id)
          return {
            id: line.id,
            name: line.name,
            quantity: line.quantity,
            unit: line.unit,
            provenance: baselineLine?.provenance ?? [],
          }
        })
        changes = canonicalized.changes ?? []
        polishStatus = 'pending_review'
        polishResponse = canonicalized
        hints = polishHints

        logger.info('shopping_list.polish_pending_review', {
          planId,
          hintCount: polishHints.length,
          failuresByRule: summarizeFailuresByRule(validation.failures),
        })
      }
    }
    catch (err) {
      const abortedDueToTimeout = isPolishAbortTimeout(err)
      logger.warn('shopping_list.polish_failed', {
        planId,
        abortedDueToTimeout,
        polishStatus: 'baseline_fallback',
        error: err instanceof Error ? err.message : String(err),
      })
      warnings.push(
        abortedDueToTimeout
          ? 'AI polish timed out; returning baseline. Try increasing OPENROUTER_SHOPPING_LIST_TIMEOUT_MS.'
          : 'AI polish failed; returning baseline.',
      )
      polishStatus = 'baseline_fallback'
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
    ...(hints ? { hintCount: hints.length } : {}),
  })

  return { consolidatedLines, baselineLines, changes, polishStatus, warnings, polishResponse, hints, sourceFingerprint }
}

/** Counts harness validation failures per rule for structured logging. */
function summarizeFailuresByRule(
  failures: Array<{ rule: string }>,
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const failure of failures) {
    counts[failure.rule] = (counts[failure.rule] ?? 0) + 1
  }
  return counts
}
