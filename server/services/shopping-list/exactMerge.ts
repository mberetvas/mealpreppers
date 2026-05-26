import type { ShoppingListSection } from '../../../utils/shoppingList'

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
}

export interface RecipeProvenance {
  recipeId: string
  recipeTitle: string
}

export interface PolishBaseline {
  lines: MergedLine[]
}

export interface PolishContext {
  lines: Array<{
    id: string
    name: string
    quantity: number | undefined
    unit: string | undefined
    provenance: RecipeProvenance[]
  }>
}

/** Rounds a number to at most 2 decimal places, eliminating floating-point noise. */
function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Normalizes a unit string using ingestion aliases, returns undefined for unknown/absent units. */
function normalizeUnit(unit: string | undefined): string | undefined {
  if (!unit) return undefined
  return UNIT_ALIASES.get(unit.toLowerCase()) ?? unit.toLowerCase()
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

/** Builds the compact polish context JSON consumed by the AI polish prompt. */
export function buildPolishContext(baseline: PolishBaseline): PolishContext {
  return {
    lines: baseline.lines.map(line => ({
      id: line.id,
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
      provenance: line.provenance,
    })),
  }
}
