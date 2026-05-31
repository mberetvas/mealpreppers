import { canonicalDisplayName } from './exactMerge'
import type { AisleCategory } from './aisleSort'

/** Substring match on normalized ingredient name (comma prep suffix stripped). */
function nameIncludes(name: string, fragment: string): boolean {
  return name.includes(fragment)
}

/** Whole-word / hyphenated-token match (avoids "uitgelekt" matching "ui"). */
function nameHasWord(name: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[\\s,-])${escaped}(?:$|[\\s,-])`, 'i').test(name)
}

/**
 * Deterministic Dutch/Belgian supermarket aisle guess from ingredient name.
 * Used during polish canonicalization; returns null when uncertain so AI choice stands.
 */
export function inferAisleCategoryFromName(rawName: string): AisleCategory | null {
  const name = canonicalDisplayName(rawName).toLowerCase()

  if (
    nameIncludes(name, 'poeder')
    || nameIncludes(name, 'zout')
    || nameIncludes(name, 'lookpoeder')
    || nameIncludes(name, '5 spice')
    || nameIncludes(name, 'vijfkruiden')
    || nameIncludes(name, 'paprikapoeder')
    || nameIncludes(name, 'kerriepoeder')
    || nameIncludes(name, 'chilipoeder')
  ) {
    return 'spices'
  }

  if (
    nameIncludes(name, 'kikkererwten')
    || nameIncludes(name, 'tomatenblokjes')
    || nameIncludes(name, 'tomatenpuree')
    || nameIncludes(name, 'bouillon')
    || nameIncludes(name, 'ketchup')
    || nameIncludes(name, 'chilisaus')
    || nameIncludes(name, 'babymaïs')
    || nameIncludes(name, 'babymais')
  ) {
    return 'canned_sauces'
  }

  if (
    nameIncludes(name, 'chorizo')
    || nameIncludes(name, 'spek')
    || nameIncludes(name, 'kip')
    || nameIncludes(name, 'gehakt')
    || nameIncludes(name, 'worst')
    || nameIncludes(name, 'ham')
  ) {
    return 'meat'
  }

  if (
    nameIncludes(name, 'rijst')
    || nameIncludes(name, 'pasta')
    || name === 'bloem'
    || nameIncludes(name, 'bloem ')
    || nameIncludes(name, ' suiker')
    || name.startsWith('suiker')
    || nameIncludes(name, 'maïzena')
    || nameIncludes(name, 'maizena')
  ) {
    return 'dry_goods'
  }

  if (
    nameIncludes(name, 'melk')
    || nameIncludes(name, 'kaas')
    || nameIncludes(name, 'room')
    || nameIncludes(name, 'yoghurt')
    || nameIncludes(name, 'boter')
  ) {
    return 'dairy'
  }

  if (nameIncludes(name, 'olie') || nameIncludes(name, 'azijn')) {
    return 'oils'
  }

  if (name === 'water' || nameIncludes(name, 'water ')) {
    return 'beverages'
  }

  if (
    nameIncludes(name, 'lente-ui')
    || nameHasWord(name, 'ui')
    || nameHasWord(name, 'uien')
    || nameIncludes(name, 'knoflook')
    || nameIncludes(name, 'paprika')
    || nameIncludes(name, 'bloemkool')
    || nameIncludes(name, 'gember')
    || nameIncludes(name, 'peterselie')
    || nameIncludes(name, 'sugar snap')
    || nameIncludes(name, 'sojascheut')
    || nameIncludes(name, 'tomaat')
    || nameIncludes(name, 'tomaten')
    || name === 'peper'
    || nameIncludes(name, 'peper ')
  ) {
    return 'produce'
  }

  return null
}
