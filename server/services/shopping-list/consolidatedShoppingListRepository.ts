import type { SupabaseClient } from '@supabase/supabase-js'
import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm'
import { z } from 'zod'
import type { WeekPlanV1 } from '../../../types/planning'
import type { AppDb } from '../../db/sqlite'
import { mealWeekTemplates } from '../../db/schema/planning'
import type { PlanningPrincipal } from '../planning/planningPrincipal'
import type { PlanningResult } from '../planning/planningResult'
import { fail, ok } from '../planning/planningResult'
import { interpretSavedWeekplanAccess } from '../planning/savedWeekplanAccess'
import { computeSourceFingerprint } from './sourceFingerprint'
import { AISLE_CATEGORY_ORDER } from './aisleSort'
import type { AisleCategory } from './aisleSort'

/** Persisted shape stored in the `consolidated_shopping_list` JSONB column. */
export interface SavedConsolidatedShoppingListRecord {
  lines: SavedShoppingListLine[]
  sourceFingerprint: string
  confirmedAt: string
}

export interface SavedShoppingListLine {
  id: string
  name: string
  quantity: number | undefined
  unit: string | undefined
  aisleCategory?: AisleCategory
}

export interface ShoppingListFlags {
  hasSavedShoppingList: boolean
  shoppingListDeprecated: boolean
}

// --- Validation schema ---

const savedLineSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  aisleCategory: z.enum(AISLE_CATEGORY_ORDER).optional(),
})

const consolidatedShoppingListInputSchema = z.object({
  lines: z.array(savedLineSchema).min(1),
})

export interface ValidationResult {
  valid: boolean
  lines?: SavedShoppingListLine[]
  error?: string
}

/** Validates client input for PUT consolidated shopping list. Strips any client-supplied fingerprint. */
export function validateConsolidatedShoppingListInput(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Request body must be an object with a lines array.' }
  }

  const parsed = consolidatedShoppingListInputSchema.safeParse(input)
  if (!parsed.success) {
    return { valid: false, error: parsed.error.issues[0]?.message ?? 'Invalid line shape.' }
  }

  return { valid: true, lines: parsed.data.lines }
}

/** Computes hasSavedShoppingList and shoppingListDeprecated flags for a Saved Weekplan GET response. */
export function computeShoppingListFlags(
  record: SavedConsolidatedShoppingListRecord | null,
  body: WeekPlanV1,
): ShoppingListFlags {
  if (!record) {
    return { hasSavedShoppingList: false, shoppingListDeprecated: false }
  }

  const currentFingerprint = computeSourceFingerprint(body)
  const deprecated = record.sourceFingerprint !== currentFingerprint

  return { hasSavedShoppingList: true, shoppingListDeprecated: deprecated }
}

// --- DB row shape ---

interface WeekTemplateDbRowForShoppingList {
  id: string
  body: WeekPlanV1
  consolidated_shopping_list: SavedConsolidatedShoppingListRecord | null
  owner_user_id: string | null
  anon_session_id: string | null
}

// --- Error helpers ---

function storageError(message: string | undefined, fallback: string) {
  return { kind: 'storage_error' as const, message: message ?? fallback }
}

function notFound() {
  return { kind: 'not_found' as const, entity: 'saved_weekplan' as const, message: 'Saved weekplan not found.' }
}

function forbidden() {
  return { kind: 'forbidden' as const, entity: 'saved_weekplan' as const, message: 'You do not have access to this saved weekplan.' }
}

function deprecatedList() {
  return { kind: 'deprecated_list' as const, message: 'The shopping list is outdated because the plan has changed. Please re-consolidate before saving.' }
}

/** Loads the saved consolidated shopping list for a plan, with principal access check. */
export async function getConsolidatedShoppingList(
  client: SupabaseClient,
  planId: string,
  principal: PlanningPrincipal,
): Promise<PlanningResult<SavedConsolidatedShoppingListRecord | null>> {
  const { data, error } = await client
    .from('meal_week_templates')
    .select('id, body, consolidated_shopping_list, owner_user_id, anon_session_id')
    .eq('id', planId)
    .maybeSingle()

  if (error) {
    return fail(storageError(error.message, 'Consolidated shopping list could not be loaded.'))
  }

  if (!data) {
    return fail(notFound())
  }

  const row = data as WeekTemplateDbRowForShoppingList
  const access = interpretSavedWeekplanAccess(row, principal)
  if (access === 'legacy_unowned') {
    return fail(notFound())
  }
  if (access === 'wrong_owner') {
    return fail(forbidden())
  }

  const record = row.consolidated_shopping_list
  if (!record) {
    return ok(null)
  }
  return ok({
    ...record,
    lines: record.lines,
  })
}

export interface CopyOnMatchResult {
  copied: boolean
  copiedList?: SavedConsolidatedShoppingListRecord
}

/**
 * Called after a new plan is created. Looks up whether another plan owned by the same
 * principal has a valid confirmed shopping list whose fingerprint matches `fingerprint`
 * (i.e. the new plan's body fingerprint). If found, copies that list to the new plan
 * immediately — no review gate, no extra client round-trip.
 *
 * Rules:
 * - Scoped to the same principal (owner_user_id or anon_session_id).
 * - Source list must be non-null and not deprecated (its sourceFingerprint must match
 *   the current fingerprint of the source plan's body).
 * - Tie-break: source with the highest `confirmedAt` is used.
 * - Returns { copied: true, copiedList } on success, { copied: false } when no match.
 */
function principalFilterForCopy(principal: PlanningPrincipal) {
  if (principal.kind === 'user') {
    return and(
      eq(mealWeekTemplates.ownerUserId, principal.userId),
      isNull(mealWeekTemplates.anonSessionId),
    )
  }
  return and(
    eq(mealWeekTemplates.anonSessionId, principal.sessionId),
    isNull(mealWeekTemplates.ownerUserId),
  )
}

export async function copyConsolidatedListFromMatchingPlan(
  db: AppDb,
  newPlanId: string,
  principal: PlanningPrincipal,
  fingerprint: string,
): Promise<PlanningResult<CopyOnMatchResult>> {
  try {
    const rows = db
      .select({
        id: mealWeekTemplates.id,
        body: mealWeekTemplates.body,
        consolidatedShoppingList: mealWeekTemplates.consolidatedShoppingList,
      })
      .from(mealWeekTemplates)
      .where(and(
        principalFilterForCopy(principal),
        isNotNull(mealWeekTemplates.consolidatedShoppingList),
        ne(mealWeekTemplates.id, newPlanId),
      ))
      .all()

    const validMatches = rows.filter((row) => {
      const list = row.consolidatedShoppingList
      if (!list) return false
      if (list.sourceFingerprint !== fingerprint) return false
      return computeSourceFingerprint(row.body) === fingerprint
    })

    if (validMatches.length === 0) {
      return ok({ copied: false })
    }

    validMatches.sort((a, b) =>
      b.consolidatedShoppingList!.confirmedAt.localeCompare(a.consolidatedShoppingList!.confirmedAt),
    )

    const listToCopy = validMatches[0]!.consolidatedShoppingList!

    db.update(mealWeekTemplates)
      .set({ consolidatedShoppingList: listToCopy })
      .where(eq(mealWeekTemplates.id, newPlanId))
      .run()

    return ok({ copied: true, copiedList: listToCopy })
  }
  catch (error) {
    return fail(storageError(
      error instanceof Error ? error.message : undefined,
      'Could not look up matching plans for copy-on-match.',
    ))
  }
}

/** Saves a confirmed consolidated shopping list. Server computes sourceFingerprint from plan body. Rejects if existing list is deprecated. */
export async function saveConsolidatedShoppingList(
  client: SupabaseClient,
  planId: string,
  principal: PlanningPrincipal,
  lines: SavedShoppingListLine[],
): Promise<PlanningResult<SavedConsolidatedShoppingListRecord>> {
  // Load plan to verify ownership and get body for fingerprint
  const { data, error: loadError } = await client
    .from('meal_week_templates')
    .select('id, body, owner_user_id, anon_session_id, consolidated_shopping_list')
    .eq('id', planId)
    .maybeSingle()

  if (loadError) {
    return fail(storageError(loadError.message, 'Consolidated shopping list could not be saved.'))
  }

  if (!data) {
    return fail(notFound())
  }

  const row = data as WeekTemplateDbRowForShoppingList
  const access = interpretSavedWeekplanAccess(row, principal)
  if (access === 'legacy_unowned') {
    return fail(notFound())
  }
  if (access === 'wrong_owner') {
    return fail(forbidden())
  }

  // Reject save when existing list is deprecated (fingerprint mismatch)
  if (row.consolidated_shopping_list) {
    const currentFingerprint = computeSourceFingerprint(row.body)
    if (row.consolidated_shopping_list.sourceFingerprint !== currentFingerprint) {
      return fail(deprecatedList())
    }
  }

  // Server computes fingerprint from current body
  const sourceFingerprint = computeSourceFingerprint(row.body)
  const confirmedAt = new Date().toISOString()

  const record: SavedConsolidatedShoppingListRecord = {
    lines,
    sourceFingerprint,
    confirmedAt,
  }

  const { error: updateError } = await client
    .from('meal_week_templates')
    .update({ consolidated_shopping_list: record })
    .eq('id', planId)
    .select('id')
    .single()

  if (updateError) {
    return fail(storageError(updateError.message, 'Consolidated shopping list could not be saved.'))
  }

  return ok(record)
}
