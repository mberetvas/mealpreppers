import type { MergedLine, PolishBaseline } from './exactMerge'

export interface PolishResponseLine {
  id: string
  name: string
  quantity: number | undefined
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

export type ValidationRule = 'no-invented-ingredients' | 'missing-baseline-line' | 'quantity-cap' | 'unit-policy'

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

  const baselineLineById = buildBaselineLineByIdMap(baseline)
  const baselineQuantityByNameUnit = buildBaselineQuantityMap(baseline)
  const baselineUnitsByName = buildBaselineUnitsMap(baseline)

  const responseLineIds = new Set(response.lines.map(line => line.id))

  for (const baselineLine of baseline.lines) {
    if (!responseLineIds.has(baselineLine.id)) {
      failures.push({
        rule: 'missing-baseline-line',
        lineId: baselineLine.id,
        message: `Baseline line id "${baselineLine.id}" is missing from polish response`,
      })
    }
  }

  for (const line of response.lines) {
    const baselineLine = baselineLineById.get(line.id)
    if (!baselineLine) {
      failures.push({
        rule: 'no-invented-ingredients',
        lineId: line.id,
        message: `Line id "${line.id}" does not exist in baseline`,
      })
      continue
    }
    validateUnitPolicy(line, baselineLine, baselineUnitsByName, failures)
    validateQuantityCap(line, baselineLine, baselineQuantityByNameUnit, failures)
  }

  return { valid: failures.length === 0, failures }
}

/** Builds a map of baseline line id → baseline line. */
function buildBaselineLineByIdMap(baseline: PolishBaseline): Map<string, MergedLine> {
  return new Map(baseline.lines.map(line => [line.id, line]))
}

/** Builds a map of (lowercased name, unit) → total baseline quantity. */
function buildBaselineQuantityMap(baseline: PolishBaseline): Map<string, number> {
  const map = new Map<string, number>()
  for (const line of baseline.lines) {
    if (line.quantity === undefined) continue
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
  baselineLine: MergedLine,
  baselineUnitsByName: Map<string, Set<string | undefined>>,
  failures: ValidationFailure[],
): void {
  const allowedUnits = baselineUnitsByName.get(baselineLine.name.toLowerCase())

  if (!allowedUnits?.has(line.unit)) {
    failures.push({
      rule: 'unit-policy',
      lineId: line.id,
      message: `Unit "${line.unit}" not present in baseline for ingredient "${line.name}"`,
    })
  }
}

function validateQuantityCap(
  line: PolishResponseLine,
  baselineLine: MergedLine,
  baselineQuantityByNameUnit: Map<string, number>,
  failures: ValidationFailure[],
): void {
  const key = quantityKey(baselineLine.name, line.unit)
  const cap = baselineQuantityByNameUnit.get(key)

  if (cap === undefined || line.quantity === undefined) {
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
