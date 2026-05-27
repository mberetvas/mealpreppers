import type { ShoppingListSection } from '../../../utils/shoppingList'
import type { AisleCategory } from './aisleSort'

/** Canonical unit aliases shared with recipe ingestion normalizers. */
const UNIT_ALIASES = new Map<string, string>([
  ['g', 'g'],
  ['gr', 'g'],
  ['gr.', 'g'],
  ['gram', 'g'],
  ['kg', 'kg'],
  ['l', 'l'],
  ['liter', 'l'],
  ['dl', 'dl'],
  ['deciliter', 'dl'],
  ['ml', 'ml'],
  ['el', 'el'],
  ['eetlepel', 'el'],
  ['eetlepels', 'el'],
  ['kl', 'kl'],
  ['tl', 'tl'],
  ['koffielepel', 'kl'],
  ['koffielepels', 'kl'],
  ['theelepel', 'tl'],
  ['theelepels', 'tl'],
  ['bussel', 'bussel'],
  ['bussels', 'bussels'],
  ['bosje', 'bosje'],
  ['bosjes', 'bosjes'],
  ['bakje', 'bakje'],
  ['bakjes', 'bakjes'],
  ['teentje', 'teentje'],
  ['teentjes', 'teentje'],
  ['scheutje', 'scheutje'],
  ['snuifje', 'snuifje'],
  ['blik', 'blik'],
  ['handvol', 'handvol'],
  ['handje', 'handje'],
])

export interface MergedLine {
  id: string
  name: string
  quantity: number | undefined
  unit: string | undefined
  provenance: RecipeProvenance[]
  /** Set by AI polish; omitted on exact-merge fallback and legacy saved lists. */
  aisleCategory?: AisleCategory
}

export interface RecipeProvenance {
  recipeId: string
  recipeTitle: string
}

export interface PolishBaseline {
  lines: MergedLine[]
}

export interface ConsolidationContextIngredient {
  id: string
  name: string
  quantity: number | undefined
  unit: string | undefined
}

export interface ConsolidationContextSection {
  recipeId: string
  recipeTitle: string
  ingredients: ConsolidationContextIngredient[]
}

/** Recipe-grouped ingredients sent to AI polish (unmerged, stable per-recipe line ids). */
export interface ConsolidationContext {
  sections: ConsolidationContextSection[]
}

/** Rounds a number to at most 2 decimal places, eliminating floating-point noise. */
export function roundPolishQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Normalizes a unit string using ingestion aliases; returns undefined for absent/empty units, preserves unknown units with lowercase normalization. */
export function normalizeShoppingListUnit(unit: string | undefined | null): string | undefined {
  if (unit == null) return undefined
  const trimmed = unit.trim()
  if (!trimmed) return undefined
  return UNIT_ALIASES.get(trimmed.toLowerCase()) ?? trimmed.toLowerCase()
}

function roundQuantity(value: number): number {
  return roundPolishQuantity(value)
}

function normalizeUnit(unit: string | undefined): string | undefined {
  return normalizeShoppingListUnit(unit)
}

/** Strips preparation suffixes (e.g. ", in ringen") for merge comparison and display. */
export function canonicalDisplayName(name: string): string {
  const commaIndex = name.indexOf(',')
  return (commaIndex === -1 ? name : name.slice(0, commaIndex)).trim()
}

/** Normalizes ingredient names for merge keys: lowercase, trim, strip preparation suffix. */
function normalizeIngredientNameForMerge(name: string): string {
  return canonicalDisplayName(name).toLowerCase()
}

/** Picks the shorter canonical label when merging differently worded variants. */
function pickDisplayName(current: string, incoming: string): string {
  const currentCanonical = canonicalDisplayName(current)
  const incomingCanonical = canonicalDisplayName(incoming)
  if (incomingCanonical.length < currentCanonical.length) return incomingCanonical
  if (currentCanonical.length < incomingCanonical.length) return currentCanonical
  return current
}

/**
 * Builds a merge key from normalized ingredient name, unit, and quantification mode.
 * Lines with the same key are combined; different keys remain separate.
 */
function mergeKey(name: string, unit: string | undefined, hasQuantity: boolean): string {
  const normalizedName = normalizeIngredientNameForMerge(name)
  const normalizedUnit = normalizeUnit(unit) ?? ''
  const quantification = hasQuantity ? 'q' : 'nq'
  return `${normalizedName}::${normalizedUnit}::${quantification}`
}

/**
 * Performs deterministic exact merge of shopping list sections into a polish baseline.
 * Iterates sections in order, merging lines with identical normalized name + unit.
 * Assigns stable L{n} ids based on first-encounter merge order.
 */
export function exactMerge(sections: ShoppingListSection[]): PolishBaseline {
  const mergeMap = new Map<string, {
    name: string
    quantity: number | undefined
    unit: string | undefined
    provenance: RecipeProvenance[]
  }>()
  const insertionOrder: string[] = []

  for (const section of sections) {
    for (const ingredient of section.ingredients) {
      const hasQuantity = ingredient.quantity !== undefined
      const key = mergeKey(ingredient.name, ingredient.unit, hasQuantity)

      const existing = mergeMap.get(key)
      if (existing) {
        if (hasQuantity && existing.quantity !== undefined) {
          existing.quantity = roundQuantity(existing.quantity + ingredient.quantity!)
        }
        existing.name = pickDisplayName(existing.name, ingredient.name)
        if (!existing.provenance.some(p => p.recipeId === section.recipeId)) {
          existing.provenance.push({ recipeId: section.recipeId, recipeTitle: section.recipeTitle })
        }
      }
      else {
        mergeMap.set(key, {
          name: canonicalDisplayName(ingredient.name),
          quantity: ingredient.quantity,
          unit: normalizeUnit(ingredient.unit),
          provenance: [{ recipeId: section.recipeId, recipeTitle: section.recipeTitle }],
        })
        insertionOrder.push(key)
      }
    }
  }

  const lines: MergedLine[] = insertionOrder.map((key, index) => {
    const entry = mergeMap.get(key)!
    return {
      id: `L${index + 1}`,
      name: entry.name,
      quantity: entry.quantity,
      unit: entry.unit,
      provenance: entry.provenance,
    }
  })

  return { lines }
}

/**
 * Maps shopping list sections to recipe-grouped consolidation context with stable ids
 * `{recipeId}:{ingredientIndex}` per ingredient row.
 */
export function buildConsolidationContext(sections: ShoppingListSection[]): ConsolidationContext {
  return {
    sections: sections.map(section => ({
      recipeId: section.recipeId,
      recipeTitle: section.recipeTitle,
      ingredients: section.ingredients.map((ingredient, index) => ({
        id: `${section.recipeId}:${index}`,
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      })),
    })),
  }
}

/** Flat source snapshot for harness validation (one line per recipe ingredient, stable ids). */
export function buildSourceBaseline(context: ConsolidationContext): PolishBaseline {
  const lines: MergedLine[] = []
  for (const section of context.sections) {
    for (const ingredient of section.ingredients) {
      lines.push({
        id: ingredient.id,
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: normalizeShoppingListUnit(ingredient.unit),
        provenance: [{ recipeId: section.recipeId, recipeTitle: section.recipeTitle }],
      })
    }
  }
  return { lines }
}
