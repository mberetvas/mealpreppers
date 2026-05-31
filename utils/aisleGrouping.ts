import {
  AISLE_CATEGORY_ORDER,
  type AisleCategory,
} from '~~/shared/aisleSort'

/** Dutch aisle labels for Belgian/Dutch supermarket walk order. */
export const AISLE_LABELS: Record<AisleCategory, string> = {
  produce: 'Groente & fruit',
  bakery: 'Brood & gebak',
  meat: 'Vlees',
  fish: 'Vis',
  dairy: 'Zuivel',
  frozen: 'Diepvries',
  dry_goods: 'Droogwaren',
  spices: 'Kruiden & specerijen',
  canned_sauces: 'Conserven & sauzen',
  oils: 'Oliën & azijn',
  beverages: 'Dranken',
  other: 'Overig',
}

export interface AisleGroup<T extends { name: string, aisleCategory?: AisleCategory }> {
  category: AisleCategory
  /** Dutch display label for the aisle. */
  label: string
  lines: T[]
}

/** True when at least one line carries an AI-assigned aisle category. */
export function hasAisleCategories(
  lines: Array<{ aisleCategory?: AisleCategory }>,
): boolean {
  return lines.some(line => line.aisleCategory !== undefined)
}

/**
 * Partitions lines into labeled aisle groups using each line's AI-assigned
 * `aisleCategory`, preserving array order (run-length grouping). Returns [] when
 * no lines have categories (legacy saved lists).
 */
export function groupLinesByAisle<T extends { name: string, aisleCategory?: AisleCategory }>(
  lines: T[],
): AisleGroup<T>[] {
  if (!hasAisleCategories(lines)) {
    return []
  }

  const groups: AisleGroup<T>[] = []

  for (const line of lines) {
    const category = line.aisleCategory ?? 'other'
    const last = groups[groups.length - 1]
    if (last && last.category === category) {
      last.lines.push(line)
    }
    else {
      groups.push({
        category,
        label: AISLE_LABELS[category],
        lines: [line],
      })
    }
  }

  return groups
}

/** Exposed for tests and docs referencing the canonical walk-order enum. */
export { AISLE_CATEGORY_ORDER }
