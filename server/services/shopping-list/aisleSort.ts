import { canonicalDisplayName } from './exactMerge'

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

interface AisleRule {
  category: AisleCategory
  keywords: string[]
}

/** First matching rule wins; frozen and proteins are checked before broad produce/dairy.
 *  Spices, oils, and canned_sauces are checked before produce to prevent false prefix
 *  matches (e.g. paprikapoeder → paprika, appelazijn → appel, tomatenpuree → tomaten).
 */
const AISLE_RULES: AisleRule[] = [
  {
    category: 'frozen',
    keywords: ['diepvries', 'ingevroren'],
  },
  {
    category: 'fish',
    keywords: [
      'zalm', 'tonijn', 'heilbot', 'kabeljauw', 'forel', 'garnaal', 'gamba', 'garnalen',
      'mossel', 'mosselen', 'vis', 'sardine', 'ansjovis', 'krab', 'scampi',
    ],
  },
  {
    category: 'meat',
    keywords: [
      'kip', 'kippen', 'kotelet', 'gehakt', 'rund', 'varken', 'varkens', 'worst', 'spek',
      'bacon', 'ham', 'salami', 'merguez', 'lam', 'lams', 'braadworst', 'chipolata',
      'entrecote', 'biefstuk', 'ribeye', 'schnitzel',
    ],
  },
  {
    category: 'dairy',
    keywords: [
      'melk', 'room', 'kaas', 'boter', 'yoghurt', 'yogurt', 'kwark', 'crème fraîche',
      'mascarpone', 'feta', 'parmezaan', 'mozzarella', 'ei', 'eieren', 'slagroom',
    ],
  },
  {
    category: 'bakery',
    keywords: [
      'brood', 'baguette', 'croissant', 'tortilla', 'wrap', 'pistolet', 'ciabatta',
      'bolletje', 'sandwich', 'pita',
    ],
  },
  {
    // Checked before produce so compound forms like paprikapoeder do not match
    // the produce keyword paprika via prefix matching.
    category: 'spices',
    keywords: [
      'paprikapoeder', 'kerriepoeder', 'currypoeder', 'chilipoeder', 'cayennepeper',
      'kurkuma', 'komijn', 'kaneel', 'nootmuskaat', 'kardemom', 'oregano',
      'kruidenmix', 'specerijenmix',
    ],
  },
  {
    // Checked before produce so compound forms like appelazijn do not match
    // the produce keyword appel via prefix matching.
    category: 'oils',
    keywords: [
      'olie', 'olijfolie', 'azijn', 'appelazijn', 'margarine', 'bakboter',
    ],
  },
  {
    // Checked before produce so tomaten-prefixed sauces (tomatenpuree, tomatenblokjes,
    // gepelde tomaten) do not match the produce keyword tomaten via prefix matching.
    category: 'canned_sauces',
    keywords: [
      'passata', 'gepelde tomaten', 'tomatenblokjes', 'tomatenpuree', 'tomatensaus',
      'bouillon', 'sojasaus', 'ketjap', 'mosterd', 'ketchup', 'mayonaise', 'pesto',
      'concentraat', 'blik', 'conserv', 'kappertjes', 'augurk', 'mais conserv',
    ],
  },
  {
    category: 'produce',
    keywords: [
      'tomaat', 'tomaten', 'ui', 'uien', 'wortel', 'wortelen', 'paprika', 'komkommer',
      'sla', 'courgette', 'aardappel', 'aardappelen', 'knoflook', 'basilicum', 'peterselie',
      'dille', 'tijm', 'rozemarijn', 'citroen', 'citroenen', 'appel', 'appels', 'peer',
      'peren', 'banaan', 'bananen', 'spinazie', 'prei', 'selder', 'champignon', 'champignons',
      'avocado', 'gember', 'aubergine', 'courgette', 'bloemkool', 'broccoli', 'boontje',
      'boontjes', 'sperziebonen', 'maïs', 'mais', 'radijs', 'bleekselder', 'tuinkers',
    ],
  },
  {
    category: 'dry_goods',
    keywords: [
      'pasta', 'spaghetti', 'penne', 'tagliatelle', 'fusilli', 'rigatoni', 'farfalle', 'rijst',
      'bloem', 'suiker', 'rozijn',
      'rozijnen', 'noot', 'noten', 'amandel', 'amandelen', 'walnoot', 'linzen', 'kikkererwt',
      'kikkererwten', 'couscous', 'quinoa', 'havermout', 'muesli', 'cornflakes', 'paneermeel',
      'gist', 'chocolade',
    ],
  },
  {
    category: 'beverages',
    keywords: [
      'wijn', 'bier', 'water', 'sap', 'cola', 'koffie', 'thee', 'frisdrank', 'limonade',
    ],
  },
]

/** Normalizes an ingredient name for aisle keyword matching. */
function normalizeNameForAisle(name: string): string {
  return canonicalDisplayName(name).toLowerCase()
}

/** Returns true when keyword appears as a whole word or name prefix in Dutch ingredient labels. */
function matchesAisleKeyword(normalizedName: string, keyword: string): boolean {
  if (normalizedName === keyword) return true
  if (normalizedName.startsWith(`${keyword} `) || normalizedName.startsWith(`${keyword},`)) return true
  if (normalizedName.endsWith(` ${keyword}`) || normalizedName.endsWith(` ${keyword},`)) return true
  if (normalizedName.includes(` ${keyword} `) || normalizedName.includes(` ${keyword},`)) return true
  if (keyword.length >= 4 && normalizedName.startsWith(keyword)) return true
  if (keyword.length <= 3) {
    return new RegExp(`(?:^|[\\s,])${keyword}(?:$|[\\s,])`).test(normalizedName)
  }
  return false
}

/** Infers supermarket aisle category from an ingredient name (does not rename). */
export function inferAisleCategory(name: string): AisleCategory {
  const normalized = normalizeNameForAisle(name)
  for (const rule of AISLE_RULES) {
    for (const keyword of rule.keywords) {
      if (matchesAisleKeyword(normalized, keyword)) {
        return rule.category
      }
    }
  }
  return 'other'
}

/** Numeric sort index for an aisle category. */
export function aisleCategorySortIndex(category: AisleCategory): number {
  return AISLE_CATEGORY_ORDER.indexOf(category)
}

/**
 * Sorts shopping list lines for in-store shopping: aisle order, then name (nl locale).
 * Stable for equal keys; does not alter id, name, quantity, or unit.
 */
export function sortShoppingListLines<T extends { name: string }>(lines: T[]): T[] {
  return [...lines]
    .map((line, index) => ({
      line,
      index,
      categoryIndex: aisleCategorySortIndex(inferAisleCategory(line.name)),
    }))
    .sort((a, b) => {
      if (a.categoryIndex !== b.categoryIndex) {
        return a.categoryIndex - b.categoryIndex
      }
      const byName = a.line.name.localeCompare(b.line.name, 'nl', { sensitivity: 'base' })
      if (byName !== 0) return byName
      return a.index - b.index
    })
    .map(({ line }) => line)
}
