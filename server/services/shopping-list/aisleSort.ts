/** Supermarket walk order for Belgian/Dutch stores (entrance → checkout). */
export const AISLE_CATEGORY_ORDER = [
  'produce',
  'bakery',
  'meat',
  'fish',
  'dairy',
  'frozen',
  'dry_goods',
  'spices',
  'canned_sauces',
  'oils',
  'beverages',
  'other',
] as const

export type AisleCategory = (typeof AISLE_CATEGORY_ORDER)[number]

/** Coerces unknown values to a valid aisle category; invalid values become `other`. */
export function coerceAisleCategory(value: unknown): AisleCategory {
  if (typeof value === 'string' && (AISLE_CATEGORY_ORDER as readonly string[]).includes(value)) {
    return value as AisleCategory
  }
  return 'other'
}
