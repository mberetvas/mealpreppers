import {
  inferAisleCategory,
  AISLE_CATEGORY_ORDER,
  type AisleCategory,
} from '../server/services/shopping-list/aisleSort'

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

export interface AisleGroup<T extends { name: string }> {
  category: AisleCategory
  /** Dutch display label for the aisle. */
  label: string
  lines: T[]
}

/**
 * Partitions lines into labeled aisle groups using inferAisleCategory, ordered
 * by AISLE_CATEGORY_ORDER (supermarket walk order). Empty groups are omitted.
 */
export function groupLinesByAisle<T extends { name: string }>(lines: T[]): AisleGroup<T>[] {
  const buckets = new Map<AisleCategory, T[]>()

  for (const line of lines) {
    const category = inferAisleCategory(line.name)
    const bucket = buckets.get(category)
    if (bucket) {
      bucket.push(line)
    }
    else {
      buckets.set(category, [line])
    }
  }

  return AISLE_CATEGORY_ORDER
    .filter(cat => buckets.has(cat))
    .map(cat => ({
      category: cat,
      label: AISLE_LABELS[cat],
      lines: buckets.get(cat)!,
    }))
}
