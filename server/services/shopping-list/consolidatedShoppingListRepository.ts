import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { AppDb } from '../../db/sqlite'
import { mealWeekTemplates } from '../../db/schema/planning'
import { sqliteSavedWeekplanReader } from '../planning/infrastructure/sqliteSavedWeekplanReader'
import type { PlanningPrincipal } from '../planning/planningPrincipal'
import type { PlanningResult } from '../planning/planningResult'
import { fail, ok } from '../planning/planningResult'
import type { SavedWeekplanReader } from '../planning/ports/savedWeekplanReader'
import { computeShoppingListFlags, type ShoppingListFlags } from '../planning/savedWeekplanReadModel'
import { computeSourceFingerprint } from './sourceFingerprint'
import { AISLE_CATEGORY_ORDER } from './aisleSort'
import type { AisleCategory } from './aisleSort'

export type { ShoppingListFlags }
export { computeShoppingListFlags }

/** Persisted shape stored in the `consolidated_shopping_list` JSON column. */
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

function storageError(message: string | undefined, fallback: string) {
  return { kind: 'storage_error' as const, message: message ?? fallback }
}

function deprecatedList() {
  return { kind: 'deprecated_list' as const, message: 'The shopping list is outdated because the plan has changed. Please re-consolidate before saving.' }
}

export interface CopyOnMatchResult {
  copied: boolean
  copiedList?: SavedConsolidatedShoppingListRecord
}

/** Loads the saved consolidated shopping list for a plan, with principal access check. */
export async function getConsolidatedShoppingList(
  db: AppDb,
  planId: string,
  principal: PlanningPrincipal,
  reader: SavedWeekplanReader = sqliteSavedWeekplanReader,
): Promise<PlanningResult<SavedConsolidatedShoppingListRecord | null>> {
  try {
    const context = await reader.getForConsolidatedListOps(db, planId, principal)
    if (!context.ok) {
      return context
    }

    const record = context.value.existingList
    if (!record) {
      return ok(null)
    }
    return ok({
      ...record,
      lines: record.lines,
    })
  }
  catch (error) {
    return fail(storageError(
      error instanceof Error ? error.message : undefined,
      'Consolidated shopping list could not be loaded.',
    ))
  }
}

/** Saves a confirmed consolidated shopping list. Server computes sourceFingerprint from plan body. Rejects if existing list is deprecated. */
export async function saveConsolidatedShoppingList(
  db: AppDb,
  planId: string,
  principal: PlanningPrincipal,
  lines: SavedShoppingListLine[],
  reader: SavedWeekplanReader = sqliteSavedWeekplanReader,
): Promise<PlanningResult<SavedConsolidatedShoppingListRecord>> {
  try {
    const context = await reader.getForConsolidatedListOps(db, planId, principal)
    if (!context.ok) {
      return context
    }

    const { body, existingList } = context.value

    if (existingList) {
      const currentFingerprint = computeSourceFingerprint(body)
      if (existingList.sourceFingerprint !== currentFingerprint) {
        return fail(deprecatedList())
      }
    }

    const sourceFingerprint = computeSourceFingerprint(body)
    const confirmedAt = new Date().toISOString()

    const record: SavedConsolidatedShoppingListRecord = {
      lines,
      sourceFingerprint,
      confirmedAt,
    }

    db.update(mealWeekTemplates)
      .set({ consolidatedShoppingList: record })
      .where(eq(mealWeekTemplates.id, planId))
      .run()

    return ok(record)
  }
  catch (error) {
    return fail(storageError(
      error instanceof Error ? error.message : undefined,
      'Consolidated shopping list could not be saved.',
    ))
  }
}
