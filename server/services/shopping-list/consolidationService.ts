import type { SupabaseClient } from '@supabase/supabase-js'
import type { StructuredLogger } from '../../utils/structuredLogger'
import type { PlanningPrincipal } from '../planning/planningPrincipal'
import type { MergedLine, RecipeProvenance } from './exactMerge'
import type { PolishResponse, PolishResponseChange } from './polishHarness'
import type { ShoppingListPolishPort } from './polishPort'
import type { PolishHint } from './polishHintBuilder'
import { getSavedWeekplanById } from '../planning/savedWeekplansRepository'
import { toPlanningHttpError } from '../../utils/planningErrors'
import { collectRecipeOccurrences, buildShoppingList } from '../../../utils/shoppingList'
import {
  exactMerge,
  buildConsolidationContext,
  buildSourceBaseline,
} from './exactMerge'
import { canonicalizePolishResponse, validatePolishResponse } from './polishHarness'
import { buildPolishHints } from './polishHintBuilder'
import { computeSourceFingerprint } from './sourceFingerprint'
import { isPolishAbortTimeout } from './polishChainFactory'
import { listRecipes } from '../recipe-catalog/recipeRepository'
import type { RecipeCatalogItem } from '../../../types/recipe-catalog-item'
import { createError } from 'h3'

const AI_REQUIRED_WARNING = 'A supermarket aisle-grouped list requires successful AI consolidation. Configure OpenRouter or retry.'

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
 * build recipe-grouped context → AI polish → harness hints → pending review.
 * Fallback: exact merge baseline only (no consolidated lines) when AI is unavailable or fails.
 */
export async function consolidateShoppingList(
  planId: string,
  deps: ConsolidationDeps,
): Promise<ConsolidationResult> {
  const startTime = Date.now()
  const { supabaseClient, principal, logger, polishPort, openrouterApiKey } = deps

  logger.info('shopping_list.consolidate_start', { planId })

  const planResult = await getSavedWeekplanById(supabaseClient, planId, principal)
  if (!planResult.ok) {
    throw createError(toPlanningHttpError(planResult.error))
  }

  const plan = planResult.value
  const occurrences = collectRecipeOccurrences(plan.body)

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

  const recipesResult = await listRecipes(supabaseClient)
  if (!recipesResult.ok) {
    throw createError({ statusCode: 500, statusMessage: 'Recipes could not be loaded for consolidation.' })
  }

  const recipeMap = new Map<string, RecipeCatalogItem>(
    recipesResult.value.map(r => [r.id, r]),
  )

  const sections = buildShoppingList(occurrences, recipeMap)
  const resolvedCount = sections.length
  const totalRequested = occurrences.size
  const missingCount = totalRequested - resolvedCount

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

  const consolidationContext = buildConsolidationContext(sections)
  const sourceBaseline = buildSourceBaseline(consolidationContext)
  const fallbackBaseline = exactMerge(sections)

  const warnings: string[] = []
  let consolidatedLines: MergedLine[] = []
  let baselineLines: MergedLine[] = fallbackBaseline.lines
  let changes: PolishResponseChange[] = []
  let polishStatus: PolishStatus = 'ai_skipped'
  let polishResponse: PolishResponse | undefined
  let hints: PolishHint[] | undefined
  const sourceFingerprint = computeSourceFingerprint(plan.body)

  if (missingCount > 0) {
    logger.warn('shopping_list.partial_recipe_resolution', { planId, missingCount, totalRequested, resolvedCount })
    warnings.push(`${missingCount} recipe(s) could not be loaded — this list may be incomplete.`)
  }

  if (!openrouterApiKey) {
    logger.info('shopping_list.polish_skipped', { reason: 'missing_api_key' })
    warnings.push(AI_REQUIRED_WARNING)
    polishStatus = 'ai_skipped'
    consolidatedLines = []
  }
  else if (!polishPort) {
    logger.info('shopping_list.polish_skipped', { reason: 'no_polish_port' })
    warnings.push(AI_REQUIRED_WARNING)
    polishStatus = 'ai_skipped'
    consolidatedLines = []
  }
  else {
    try {
      const result = await polishPort.polish(consolidationContext)
      const canonicalized = canonicalizePolishResponse(result.response, sourceBaseline)
      const validation = validatePolishResponse(canonicalized, sourceBaseline)
      const polishHints = buildPolishHints(result.response, sourceBaseline)

      consolidatedLines = attachProvenanceToLines(canonicalized, sourceBaseline)
      changes = canonicalized.changes ?? []
      polishStatus = 'pending_review'
      polishResponse = canonicalized
      hints = polishHints
      baselineLines = sourceBaseline.lines

      logger.info('shopping_list.polish_pending_review', {
        planId,
        hintCount: polishHints.length,
        harnessValid: validation.valid,
        failuresByRule: summarizeFailuresByRule(validation.failures),
      })
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
          ? `AI polish timed out. ${AI_REQUIRED_WARNING} Try increasing OPENROUTER_SHOPPING_LIST_TIMEOUT_MS.`
          : `AI polish failed. ${AI_REQUIRED_WARNING}`,
      )
      polishStatus = 'baseline_fallback'
      consolidatedLines = []
    }
  }

  const latencyMs = Date.now() - startTime
  logger.info('shopping_list.consolidate_complete', {
    planId,
    latencyMs,
    sourceLineCount: sourceBaseline.lines.length,
    fallbackLineCount: fallbackBaseline.lines.length,
    consolidatedLineCount: consolidatedLines.length,
    polishStatus,
    ...(hints ? { hintCount: hints.length } : {}),
  })

  return { consolidatedLines, baselineLines, changes, polishStatus, warnings, polishResponse, hints, sourceFingerprint }
}

/** Maps AI consolidated lines to merged lines with recipe provenance from the source snapshot. */
function attachProvenanceToLines(
  response: PolishResponse,
  sourceBaseline: { lines: MergedLine[] },
): MergedLine[] {
  const sourceById = new Map(sourceBaseline.lines.map(line => [line.id, line]))
  return response.lines.map((line) => {
    const provenance = collectProvenanceForLine(line.id, response.changes, sourceById)
    return {
      id: line.id,
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
      provenance,
      aisleCategory: line.aisleCategory,
    }
  })
}

/** Collects unique recipe provenance from a consolidated line and its absorbed source ids. */
function collectProvenanceForLine(
  lineId: string,
  changes: PolishResponseChange[] | undefined,
  sourceById: Map<string, MergedLine>,
): RecipeProvenance[] {
  const sourceIds = new Set<string>([lineId])
  const change = changes?.find(c => c.id === lineId)
  for (const absorbedId of change?.absorbedIds ?? []) {
    sourceIds.add(absorbedId)
  }

  const provenance: RecipeProvenance[] = []
  const seenRecipeIds = new Set<string>()
  for (const sourceId of sourceIds) {
    const sourceLine = sourceById.get(sourceId)
    if (!sourceLine) continue
    for (const entry of sourceLine.provenance) {
      if (seenRecipeIds.has(entry.recipeId)) continue
      seenRecipeIds.add(entry.recipeId)
      provenance.push(entry)
    }
  }
  return provenance
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
