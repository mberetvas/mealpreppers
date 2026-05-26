import type { MergedLine, PolishBaseline } from './exactMerge'
import type { PolishResponse, PolishResponseLine, ValidationRule } from './polishHarness'
import { normalizeShoppingListUnit, roundPolishQuantity } from './exactMerge'
import { canonicalizePolishResponse } from './polishHarness'

export type HintSeverity = 'info' | 'error'

export interface PolishHint {
  lineId: string
  rule: ValidationRule
  severity: HintSeverity
  message: string
}

/** Maps harness validation rules to hint severity. */
const SEVERITY_BY_RULE: Record<ValidationRule, HintSeverity> = {
  'no-invented-ingredients': 'error',
  'quantity-cap': 'error',
  'unit-policy': 'error',
  'no-removed-lines': 'info',
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
  const baselineQuantityByNameUnit = buildQuantityMap(baseline)
  const baselineUnitsByName = buildUnitsMap(baseline)

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

    checkUnitPolicy(line, baselineLine, baselineUnitsByName, hints)
    checkQuantityCap(line, baselineLine, baselineQuantityByNameUnit, hints)
  }

  for (const baselineLine of baseline.lines) {
    if (!seenIds.has(baselineLine.id)) {
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

function buildQuantityMap(baseline: PolishBaseline): Map<string, number> {
  const map = new Map<string, number>()
  for (const line of baseline.lines) {
    if (line.quantity === undefined) continue
    const key = quantityKey(line.name, line.unit)
    map.set(key, (map.get(key) ?? 0) + line.quantity)
  }
  return map
}

function buildUnitsMap(baseline: PolishBaseline): Map<string, Set<string | undefined>> {
  const map = new Map<string, Set<string | undefined>>()
  for (const line of baseline.lines) {
    const name = line.name.toLowerCase()
    if (!map.has(name)) map.set(name, new Set())
    map.get(name)!.add(line.unit)
  }
  return map
}

function quantityKey(name: string, unit: string | undefined): string {
  return `${name.toLowerCase()}::${normalizeShoppingListUnit(unit) ?? ''}`
}

function checkUnitPolicy(
  line: PolishResponseLine,
  baselineLine: MergedLine,
  baselineUnitsByName: Map<string, Set<string | undefined>>,
  hints: PolishHint[],
): void {
  const allowedUnits = baselineUnitsByName.get(baselineLine.name.toLowerCase())
  const normalizedUnit = normalizeShoppingListUnit(line.unit)

  if (!allowedUnits?.has(normalizedUnit)) {
    hints.push({
      lineId: line.id,
      rule: 'unit-policy',
      severity: SEVERITY_BY_RULE['unit-policy'],
      message: `Unit "${normalizedUnit ?? ''}" not present in baseline for line "${line.id}"`,
    })
  }
}

function checkQuantityCap(
  line: PolishResponseLine,
  baselineLine: MergedLine,
  baselineQuantityByNameUnit: Map<string, number>,
  hints: PolishHint[],
): void {
  const key = quantityKey(baselineLine.name, line.unit)
  const cap = baselineQuantityByNameUnit.get(key)
  const quantity = line.quantity === undefined ? undefined : roundPolishQuantity(line.quantity)

  if (cap === undefined || quantity === undefined) return

  if (quantity > cap) {
    hints.push({
      lineId: line.id,
      rule: 'quantity-cap',
      severity: SEVERITY_BY_RULE['quantity-cap'],
      message: `Quantity ${quantity} exceeds baseline cap ${cap} for line "${line.id}"`,
    })
  }
}
