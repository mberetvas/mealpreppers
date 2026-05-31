import type { MergedLine, PolishBaseline } from './exactMerge'
import type { PolishResponse, PolishResponseLine, ValidationRule } from './polishHarness'
import { canonicalDisplayName, normalizeShoppingListUnit, roundPolishQuantity } from './exactMerge'
import { canonicalizePolishResponse } from './polishHarness'
import { convertQuantity, unitDimension } from './crossUnitMerge'

/** Extends harness ValidationRule with hint-only rules that are never harness failures. */
export type HintRule = ValidationRule | 'name-unchanged'

export type HintSeverity = 'info' | 'error'

export interface PolishHint {
  lineId: string
  rule: HintRule
  severity: HintSeverity
  message: string
}

/** Maps hint rules to severity; name-unchanged is info-only; hints never block Approve in the UI. */
const SEVERITY_BY_RULE: Record<HintRule, HintSeverity> = {
  'no-invented-ingredients': 'error',
  'quantity-cap': 'error',
  'unit-conversion': 'error',
  'name-unchanged': 'info',
  'no-removed-lines': 'error',
}

/**
 * Builds per-line polish hints from harness rule violations.
 * Unlike the harness validator which returns pass/fail for flow control,
 * the hint builder always returns hints for human review without discarding AI output.
 */
export function buildPolishHints(response: PolishResponse, baseline: PolishBaseline): PolishHint[] {
  const hints: PolishHint[] = []
  const canonicalized = canonicalizePolishResponse(response, baseline)

  const baselineLineById = new Map<string, MergedLine>(baseline.lines.map(l => [l.id, l]))
  const absorbedBaselineIds = collectAbsorbedBaselineIds(canonicalized.changes)
  const quantityCapByNameDimension = buildNameDimensionQuantityCapMap(baseline)

  const seenIds = new Set<string>()

  for (const line of canonicalized.lines) {
    if (seenIds.has(line.id)) {
      hints.push({
        lineId: line.id,
        rule: 'no-invented-ingredients',
        severity: SEVERITY_BY_RULE['no-invented-ingredients'],
        message: `Line id "${line.id}" appears more than once in polish response`,
      })
      continue
    }
    seenIds.add(line.id)

    const baselineLine = baselineLineById.get(line.id)
    if (!baselineLine) {
      hints.push({
        lineId: line.id,
        rule: 'no-invented-ingredients',
        severity: SEVERITY_BY_RULE['no-invented-ingredients'],
        message: `Line id "${line.id}" does not exist in baseline`,
      })
      continue
    }

    checkNameUnchanged(line, baselineLine, hints)
    checkUnitConversion(line, baselineLine, baseline, hints)
    checkQuantityCap(line, baselineLine, quantityCapByNameDimension, hints)
  }

  for (const baselineLine of baseline.lines) {
    if (!seenIds.has(baselineLine.id) && !absorbedBaselineIds.has(baselineLine.id)) {
      hints.push({
        lineId: baselineLine.id,
        rule: 'no-removed-lines',
        severity: SEVERITY_BY_RULE['no-removed-lines'],
        message: `Baseline line "${baselineLine.id}" is missing from polish response`,
      })
    }
  }

  return hints
}

function collectAbsorbedBaselineIds(changes: PolishResponse['changes']): Set<string> {
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
      total += converted ?? line.quantity
    }
    map.set(key, roundPolishQuantity(total))
  }

  return map
}

function checkNameUnchanged(
  line: PolishResponseLine,
  baselineLine: MergedLine,
  hints: PolishHint[],
): void {
  if (line.name.trim() !== baselineLine.name.trim()) {
    hints.push({
      lineId: line.id,
      rule: 'name-unchanged',
      severity: SEVERITY_BY_RULE['name-unchanged'],
      message: `Name "${line.name}" differs from baseline "${baselineLine.name}"`,
    })
  }
}

function checkUnitConversion(
  line: PolishResponseLine,
  baselineLine: MergedLine,
  baseline: PolishBaseline,
  hints: PolishHint[],
): void {
  const responseUnit = normalizeShoppingListUnit(line.unit)
  const baselineUnit = normalizeShoppingListUnit(baselineLine.unit)

  if (responseUnit === baselineUnit) return
  if (baselineUnit && responseUnit && convertQuantity(1, baselineUnit, responseUnit) !== null) return

  const allowedUnits = baselineUnitsForNameAndDimension(baseline, baselineLine.name, baselineLine.unit)
  if (responseUnit && allowedUnits.has(responseUnit)) return

  hints.push({
    lineId: line.id,
    rule: 'unit-conversion',
    severity: SEVERITY_BY_RULE['unit-conversion'],
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

function checkQuantityCap(
  line: PolishResponseLine,
  baselineLine: MergedLine,
  quantityCapByNameDimension: Map<NameDimensionKey, number>,
  hints: PolishHint[],
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
    hints.push({
      lineId: line.id,
      rule: 'quantity-cap',
      severity: SEVERITY_BY_RULE['quantity-cap'],
      message: `Quantity ${quantity} exceeds baseline cap ${cap} for line "${line.id}"`,
    })
  }
}
