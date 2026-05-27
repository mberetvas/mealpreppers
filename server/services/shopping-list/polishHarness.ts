import type { MergedLine, PolishBaseline } from './exactMerge'
import { canonicalDisplayName, normalizeShoppingListUnit, roundPolishQuantity } from './exactMerge'
import { convertQuantity, unitDimension } from './crossUnitMerge'
import { coerceAisleCategory, sortLinesByStoreWalkOrder, type AisleCategory } from './aisleSort'
import { inferAisleCategoryFromName } from './aisleInference'

export interface PolishResponseLine {
  id: string
  name: string
  quantity: number | undefined
  unit: string | undefined
  aisleCategory?: AisleCategory
}

export interface PolishResponseChange {
  id: string
  reason: string
  absorbedIds?: string[]
}

export interface PolishResponse {
  lines: PolishResponseLine[]
  changes?: PolishResponseChange[]
}

export type ValidationRule =
  | 'no-invented-ingredients'
  | 'quantity-cap'
  | 'unit-conversion'
  | 'no-removed-lines'

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
 * Ensures the AI model cannot invent ingredients, inflate quantities, violate unit policy,
 * drop undocumented baseline lines, or produce duplicate line ids.
 * Returns a structured pass/fail result for orchestration flow control (never throws).
 */
/**
 * Aligns model polish output with baseline conventions (line id casing, unit aliases, quantity rounding).
 */
export function canonicalizePolishResponse(response: PolishResponse, baseline: PolishBaseline): PolishResponse {
  const baselineLineById = buildBaselineLineByIdMap(baseline)
  const baselineIdByLower = new Map(baseline.lines.map(line => [line.id.toLowerCase(), line.id]))

  const lines = response.lines.map((line) => {
    const canonicalId = baselineLineById.has(line.id)
      ? line.id
      : baselineIdByLower.get(line.id.toLowerCase()) ?? line.id

    return {
      id: canonicalId,
      name: line.name,
      quantity: line.quantity === undefined ? undefined : roundPolishQuantity(line.quantity),
      unit: normalizeShoppingListUnit(line.unit),
      aisleCategory: inferAisleCategoryFromName(line.name)
        ?? coerceAisleCategory(line.aisleCategory),
    }
  })

  return {
    lines: sortLinesByStoreWalkOrder(lines),
    changes: response.changes,
  }
}

export function validatePolishResponse(response: PolishResponse, baseline: PolishBaseline): ValidationResult {
  const failures: ValidationFailure[] = []
  const canonicalResponse = canonicalizePolishResponse(response, baseline)

  const baselineLineById = buildBaselineLineByIdMap(baseline)
  const absorbedBaselineIds = collectAbsorbedBaselineIds(canonicalResponse.changes)
  const quantityCapByNameDimension = buildNameDimensionQuantityCapMap(baseline)

  const seenIds = new Set<string>()

  for (const line of canonicalResponse.lines) {
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

    validateUnitConversion(line, baselineLine, baseline, failures)
    validateQuantityCap(line, baselineLine, quantityCapByNameDimension, failures)
  }

  for (const baselineLine of baseline.lines) {
    if (!seenIds.has(baselineLine.id) && !absorbedBaselineIds.has(baselineLine.id)) {
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

/** Collects baseline line ids documented as absorbed in polish changes. */
function collectAbsorbedBaselineIds(changes: PolishResponseChange[] | undefined): Set<string> {
  const absorbed = new Set<string>()
  if (!changes) return absorbed
  for (const change of changes) {
    for (const id of change.absorbedIds ?? []) {
      absorbed.add(id)
    }
  }
  return absorbed
}

type NameDimensionKey = string

function nameDimensionKey(name: string, unit: string | undefined): NameDimensionKey {
  const dim = unitDimension(unit)
  return `${canonicalDisplayName(name)}::${dim}`
}

/** Sum of baseline quantities per exact name and unit dimension, convertible to any unit in that dimension. */
function buildNameDimensionQuantityCapMap(baseline: PolishBaseline): Map<NameDimensionKey, number> {
  const map = new Map<NameDimensionKey, number>()
  const linesByKey = new Map<NameDimensionKey, MergedLine[]>()

  for (const line of baseline.lines) {
    if (line.quantity === undefined) continue
    const key = nameDimensionKey(line.name, line.unit)
    const group = linesByKey.get(key) ?? []
    group.push(line)
    linesByKey.set(key, group)
  }

  for (const [key, lines] of linesByKey) {
    const targetUnit = normalizeShoppingListUnit(lines[0].unit)
    if (!targetUnit) continue
    let total = 0
    for (const line of lines) {
      if (line.quantity === undefined || line.unit === undefined) continue
      const converted = convertQuantity(line.quantity, line.unit, targetUnit)
      if (converted === null) {
        total += line.quantity
      }
      else {
        total += converted
      }
    }
    map.set(key, roundPolishQuantity(total))
  }

  return map
}

function validateUnitConversion(
  line: PolishResponseLine,
  baselineLine: MergedLine,
  baseline: PolishBaseline,
  failures: ValidationFailure[],
): void {
  const responseUnit = normalizeShoppingListUnit(line.unit)
  const baselineUnit = normalizeShoppingListUnit(baselineLine.unit)

  if (responseUnit === baselineUnit) return

  if (baselineUnit && responseUnit && convertQuantity(1, baselineUnit, responseUnit) !== null) {
    return
  }

  const allowedUnits = baselineUnitsForNameAndDimension(baseline, baselineLine.name, baselineLine.unit)
  if (responseUnit && allowedUnits.has(responseUnit)) {
    return
  }

  failures.push({
    rule: 'unit-conversion',
    lineId: line.id,
    message: `Unit "${responseUnit ?? ''}" is not allowed for line "${line.id}"`,
  })
}

function baselineUnitsForNameAndDimension(
  baseline: PolishBaseline,
  name: string,
  referenceUnit: string | undefined,
): Set<string> {
  const dim = unitDimension(referenceUnit)
  const units = new Set<string>()
  for (const line of baseline.lines) {
    if (canonicalDisplayName(line.name) !== canonicalDisplayName(name)) continue
    if (unitDimension(line.unit) !== dim) continue
    const normalized = normalizeShoppingListUnit(line.unit)
    if (normalized) units.add(normalized)
  }
  return units
}

function validateQuantityCap(
  line: PolishResponseLine,
  baselineLine: MergedLine,
  quantityCapByNameDimension: Map<NameDimensionKey, number>,
  failures: ValidationFailure[],
): void {
  const quantity = line.quantity === undefined ? undefined : roundPolishQuantity(line.quantity)
  if (quantity === undefined) return

  const capInBaselineUnit = quantityCapByNameDimension.get(
    nameDimensionKey(baselineLine.name, baselineLine.unit),
  )
  if (capInBaselineUnit === undefined) return

  const responseUnit = normalizeShoppingListUnit(line.unit) ?? normalizeShoppingListUnit(baselineLine.unit)
  if (!responseUnit) return

  const capConverted = convertQuantity(capInBaselineUnit, baselineLine.unit!, responseUnit)
  const cap = capConverted ?? capInBaselineUnit

  if (quantity > cap) {
    failures.push({
      rule: 'quantity-cap',
      lineId: line.id,
      message: `Quantity ${quantity} exceeds baseline cap ${cap} for line "${line.id}"`,
    })
  }
}
