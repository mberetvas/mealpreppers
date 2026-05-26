import type { MergedLine, PolishBaseline } from './exactMerge'

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

export type ValidationRule = 'no-invented-ingredients' | 'quantity-cap' | 'unit-policy' | 'no-removed-lines'

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
 * Ensures the AI model cannot invent ingredients, inflate quantities, violate unit/locale policy,
 * drop baseline lines, or produce duplicate line ids.
 * Returns a structured pass/fail result for orchestration flow control (never throws).
 */
export function validatePolishResponse(response: PolishResponse, baseline: PolishBaseline): ValidationResult {
  const failures: ValidationFailure[] = []

  const baselineLineById = buildBaselineLineByIdMap(baseline)
  const baselineQuantityByNameUnit = buildBaselineQuantityMap(baseline)

  // Track seen ids to detect duplicates and to find missing baseline lines afterwards
  const seenIds = new Set<string>()

  for (const line of response.lines) {
    if (seenIds.has(line.id)) {
      failures.push({
        rule: 'no-invented-ingredients',
        lineId: line.id,
        message: `Line id "${line.id}" appears more than once in polish response`,
      })
      continue
    }
    seenIds.add(line.id)

    const baselineLine = baselineLineById.get(line.id)
    if (!baselineLine) {
      failures.push({
        rule: 'no-invented-ingredients',
        lineId: line.id,
        message: `Line id "${line.id}" does not exist in baseline`,
      })
      continue
    }
    validateUnitPolicy(line, baselineLine, failures)
    validateQuantityCap(line, baselineLine, baselineQuantityByNameUnit, failures)
  }

  // Reject responses that drop baseline lines entirely
  for (const baselineLine of baseline.lines) {
    if (!seenIds.has(baselineLine.id)) {
      failures.push({
        rule: 'no-removed-lines',
        lineId: baselineLine.id,
        message: `Baseline line id "${baselineLine.id}" is missing from polish response`,
      })
    }
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
    const key = quantityKey(line.name, line.unit)
    map.set(key, (map.get(key) ?? 0) + line.quantity)
  }
  return map
}

function quantityKey(name: string, unit: string | undefined): string {
  return `${name.toLowerCase()}::${unit ?? ''}`
}

/** Validates that the response line's unit matches the exact unit of its baseline counterpart. */
function validateUnitPolicy(
  line: PolishResponseLine,
  baselineLine: MergedLine,
  failures: ValidationFailure[],
): void {
  if (line.unit !== baselineLine.unit) {
    failures.push({
      rule: 'unit-policy',
      lineId: line.id,
      message: `Unit "${line.unit}" not allowed; baseline unit for line "${line.id}" is "${baselineLine.unit}"`,
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

  if (cap === undefined) {
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
