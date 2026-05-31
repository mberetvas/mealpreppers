import type { MergedLine, PolishBaseline } from './exactMerge'
import { normalizeShoppingListUnit, roundPolishQuantity } from './exactMerge'

export type UnitDimension = 'mass' | 'volume' | 'count' | 'none'

const MASS_UNITS = new Set(['g', 'kg'])
const VOLUME_UNITS = new Set(['ml', 'dl', 'l'])
const COUNT_UNITS = new Set([
  'stuk',
  'stuks',
  'bussel',
  'bussels',
  'bosje',
  'bosjes',
  'bakje',
  'bakjes',
  'teentje',
  'blik',
  'handvol',
  'handje',
])

/** Mass conversion factors to grams. */
const TO_GRAMS: Record<string, number> = {
  g: 1,
  kg: 1000,
}

/** Volume conversion factors to milliliters. */
const TO_ML: Record<string, number> = {
  ml: 1,
  dl: 100,
  l: 1000,
}

const CANONICAL_UNIT_PRIORITY = ['kg', 'g', 'l', 'dl', 'ml'] as const

export interface CrossUnitMergeChange {
  id: string
  absorbedIds: string[]
  reason: string
}

export interface CrossUnitMergeResult extends PolishBaseline {
  mergeChanges: CrossUnitMergeChange[]
}

/** Maps a normalized unit to its dimension; unknown units use the unit string as its own dimension. */
export function unitDimension(unit: string | undefined): UnitDimension | string {
  if (unit == null) return 'none'
  const normalized = normalizeShoppingListUnit(unit)
  if (!normalized) return 'none'
  if (MASS_UNITS.has(normalized)) return 'mass'
  if (VOLUME_UNITS.has(normalized)) return 'volume'
  if (COUNT_UNITS.has(normalized)) return 'count'
  return normalized
}

/** Picks the preferred display unit from a set using v2 priority order. */
export function pickCanonicalUnit(units: string[]): string {
  const normalized = units.map(u => normalizeShoppingListUnit(u)).filter((u): u is string => Boolean(u))
  for (const preferred of CANONICAL_UNIT_PRIORITY) {
    if (normalized.includes(preferred)) return preferred
  }
  return normalized[0]!
}

/** Converts quantity between units in the same convertible family; returns null when unsupported. */
export function convertQuantity(quantity: number, fromUnit: string, toUnit: string): number | null {
  const from = normalizeShoppingListUnit(fromUnit)
  const to = normalizeShoppingListUnit(toUnit)
  if (!from || !to || from === to) return quantity

  if (MASS_UNITS.has(from) && MASS_UNITS.has(to)) {
    const grams = quantity * (TO_GRAMS[from] ?? 0)
    const factor = TO_GRAMS[to]
    if (!factor) return null
    return roundPolishQuantity(grams / factor)
  }

  if (VOLUME_UNITS.has(from) && VOLUME_UNITS.has(to)) {
    const ml = quantity * (TO_ML[from] ?? 0)
    const factor = TO_ML[to]
    if (!factor) return null
    return roundPolishQuantity(ml / factor)
  }

  if (from === to) return quantity
  return null
}

function isQuantified(line: MergedLine): boolean {
  return line.quantity !== undefined && line.unit !== undefined
}

function dimensionKey(line: MergedLine): string {
  if (!isQuantified(line)) return 'none'
  return String(unitDimension(line.unit))
}

function mergeProvenance(lines: MergedLine[]): MergedLine['provenance'] {
  const seen = new Set<string>()
  const provenance: MergedLine['provenance'] = []
  for (const line of lines) {
    for (const p of line.provenance) {
      if (!seen.has(p.recipeId)) {
        seen.add(p.recipeId)
        provenance.push(p)
      }
    }
  }
  return provenance
}

function sumInUnit(lines: MergedLine[], targetUnit: string): number | null {
  let total = 0
  for (const line of lines) {
    if (line.quantity === undefined || line.unit === undefined) return null
    const converted = convertQuantity(line.quantity, line.unit, targetUnit)
    if (converted === null) return null
    total += converted
  }
  return roundPolishQuantity(total)
}

/**
 * Merges baseline lines that share the exact same name and convertible units within one dimension.
 * Survivor line keeps the lexicographically smallest id and its unit; absorbed ids are recorded.
 */
export function crossUnitMerge(baseline: PolishBaseline): CrossUnitMergeResult {
  const mergeChanges: CrossUnitMergeChange[] = []
  const byName = new Map<string, MergedLine[]>()

  for (const line of baseline.lines) {
    const group = byName.get(line.name) ?? []
    group.push(line)
    byName.set(line.name, group)
  }

  const outputLines: MergedLine[] = []
  const processedNames = new Set<string>()

  for (const line of baseline.lines) {
    if (processedNames.has(line.name)) continue
    processedNames.add(line.name)

    const nameGroup = byName.get(line.name)!
    if (nameGroup.length === 1) {
      outputLines.push(nameGroup[0])
      continue
    }

    const byDimension = new Map<string, MergedLine[]>()
    for (const member of nameGroup) {
      const key = dimensionKey(member)
      const bucket = byDimension.get(key) ?? []
      bucket.push(member)
      byDimension.set(key, bucket)
    }

    for (const [, dimensionLines] of byDimension) {
      if (dimensionLines.length === 1 || !dimensionLines.every(isQuantified)) {
        outputLines.push(...dimensionLines)
        continue
      }

      const sorted = [...dimensionLines].sort((a, b) => a.id.localeCompare(b.id))
      const survivor = sorted[0]
      const targetUnit = normalizeShoppingListUnit(survivor.unit!) ?? pickCanonicalUnit(dimensionLines.map(l => l.unit!))
      const total = sumInUnit(dimensionLines, targetUnit)

      if (total === null || dimensionLines.length === 1) {
        outputLines.push(...dimensionLines)
        continue
      }

      const absorbedIds = sorted.slice(1).map(l => l.id)
      if (absorbedIds.length > 0) {
        mergeChanges.push({
          id: survivor.id,
          absorbedIds,
          reason: `Merged ${dimensionLines.length} lines with same name and convertible units`,
        })
      }

      outputLines.push({
        id: survivor.id,
        name: survivor.name,
        quantity: total,
        unit: targetUnit,
        provenance: mergeProvenance(dimensionLines),
      })
    }
  }

  return { lines: outputLines, mergeChanges }
}
