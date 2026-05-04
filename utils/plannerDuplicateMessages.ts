const LINES = [
  'That recipe is already on the menu elsewhere — bold choice, chef.',
  'Duplicate detected: Homelander would still claim he invented this dish.',
  'You already slotted this one — variety is the spice, not Compound V.',
  'Same recipe twice? The pantry auditor is watching.',
]

/**
 * Deterministic-ish line for duplicate-recipe warnings (UI toast / banner).
 */
export function duplicatePlannerMessage(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return LINES[h % LINES.length]
}
