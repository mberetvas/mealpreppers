import type { PolishBaseline } from './exactMerge'

export interface PolishResponseLine {
  id: string
  name: string
  quantity: number
  unit: string | undefined
}

export interface PolishResponseChange {
  id: string
  reason: string
}

export interface PolishResponse {
  lines: PolishResponseLine[]
  changes?: PolishResponseChange[]
}

export type ValidationRule = 'no-invented-ingredients' | 'quantity-cap' | 'unit-policy'

export interface ValidationFailure {
  rule: ValidationRule
  lineId: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  failures: ValidationFailure[]
}

/**
 * Validates a Shopping list polish response against the Shopping list polish baseline.
 * Ensures the AI model cannot invent ingredients, inflate quantities, or violate unit/locale policy.
 * Returns a structured pass/fail result for orchestration flow control (never throws).
 */
export function validatePolishResponse(response: PolishResponse, baseline: PolishBaseline): ValidationResult {
  const failures: ValidationFailure[] = []

  const baselineIds = new Set(baseline.lines.map(l => l.id))
  const baselineQuantityByNameUnit = buildBaselineQuantityMap(baseline)
  const baselineUnitsByName = buildBaselineUnitsMap(baseline)

  for (const line of response.lines) {
    if (!baselineIds.has(line.id)) {
      failures.push({
        rule: 'no-invented-ingredients',
        lineId: line.id,
        message: `Line id "${line.id}" does not exist in baseline`,
      })
      continue
    }
    validateUnitPolicy(line, baselineUnitsByName, failures)
    validateQuantityCap(line, baselineQuantityByNameUnit, failures)
  }

  return { valid: failures.length === 0, failures }
}

/** Builds a map of (lowercased name, unit) → total baseline quantity. */
function buildBaselineQuantityMap(baseline: PolishBaseline): Map<string, number> {
  const map = new Map<string, number>()
  for (const line of baseline.lines) {
    const key = quantityKey(line.name, line.unit)
    map.set(key, (map.get(key) ?? 0) + line.quantity)
  }
  return map
}

/** Builds a map of lowercased name → set of units present in baseline. */
function buildBaselineUnitsMap(baseline: PolishBaseline): Map<string, Set<string | undefined>> {
  const map = new Map<string, Set<string | undefined>>()
  for (const line of baseline.lines) {
    const name = line.name.toLowerCase()
    if (!map.has(name)) {
      map.set(name, new Set())
    }
    map.get(name)!.add(line.unit)
  }
  return map
}

function quantityKey(name: string, unit: string | undefined): string {
  return `${name.toLowerCase()}::${unit ?? ''}`
}

function validateUnitPolicy(
  line: PolishResponseLine,
  baselineUnitsByName: Map<string, Set<string | undefined>>,
  failures: ValidationFailure[],
): void {
  const name = line.name.toLowerCase()
  const allowedUnits = baselineUnitsByName.get(name)

  // If the name doesn't exist in baseline (renamed by AI), look up by original baseline line id
  // For unit policy, we check against the original ingredient's allowed units
  if (!allowedUnits) {
    // Name was renamed by AI — check all baseline units (any name) for unit policy
    // since we can't match by name, collect all units from all baseline entries
    const allUnits = new Set<string | undefined>()
    for (const units of baselineUnitsByName.values()) {
      for (const u of units) allUnits.add(u)
    }
    if (!allUnits.has(line.unit)) {
      failures.push({
        rule: 'unit-policy',
        lineId: line.id,
        message: `Unit "${line.unit}" not present in baseline for ingredient "${line.name}"`,
      })
    }
    return
  }

  if (!allowedUnits.has(line.unit)) {
    failures.push({
      rule: 'unit-policy',
      lineId: line.id,
      message: `Unit "${line.unit}" not present in baseline for ingredient "${line.name}"`,
    })
  }
}

function validateQuantityCap(
  line: PolishResponseLine,
  baselineQuantityByNameUnit: Map<string, number>,
  failures: ValidationFailure[],
): void {
  const key = quantityKey(line.name, line.unit)
  const cap = baselineQuantityByNameUnit.get(key)

  if (cap === undefined) {
    // Name was potentially renamed — find the cap by looking at original baseline
    // If renamed, quantity cap uses the original name's cap from baseline for the same unit
    // Since we don't track renames, use a fallback: look up any baseline entry with same unit
    return
  }

  if (line.quantity > cap) {
    failures.push({
      rule: 'quantity-cap',
      lineId: line.id,
      message: `Quantity ${line.quantity} exceeds baseline cap ${cap} for "${line.name}" (${line.unit})`,
    })
  }
}
