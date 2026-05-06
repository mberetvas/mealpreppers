import type { RecipeIngredientDraft } from '../../../types/recipe-draft'

export type { RecipeIngredientDraft } from '../../../types/recipe-draft'

const FRACTION_VALUES: Record<string, number> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
}

const UNIT_ALIASES = new Map<string, string>([
  ['g', 'g'],
  ['gr', 'g'],
  ['gr.', 'g'],
  ['gram', 'g'],
  ['kg', 'kg'],
  ['l', 'l'],
  ['liter', 'l'],
  ['dl', 'dl'],
  ['deciliter', 'dl'],
  ['ml', 'ml'],
  ['el', 'el'],
  ['eetlepel', 'el'],
  ['eetlepels', 'el'],
  ['kl', 'kl'],
  ['tl', 'tl'],
  ['koffielepel', 'kl'],
  ['koffielepels', 'kl'],
  ['theelepel', 'tl'],
  ['theelepels', 'tl'],
  ['bussel', 'bussel'],
  ['bussels', 'bussels'],
  ['bosje', 'bosje'],
  ['bosjes', 'bosjes'],
  ['bakje', 'bakje'],
  ['bakjes', 'bakjes'],
  ['teentje', 'teentje'],
  ['teentjes', 'teentjes'],
  ['scheutje', 'scheutje'],
  ['snuifje', 'snuifje'],
  ['blik', 'blik'],
  ['handvol', 'handvol'],
  ['handje', 'handje'],
])

export function cleanText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&euml;/gi, 'ë')
    .replace(/&eacute;/gi, 'é')
    .replace(/&egrave;/gi, 'è')
    .replace(/&iuml;/gi, 'ï')
    .replace(/&icirc;/gi, 'î')
    .replace(/&agrave;/gi, 'à')
}

export function parseLocalizedNumber(value: string | number | null | undefined): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }

  if (!value) {
    return undefined
  }

  const normalized = cleanText(value).replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function parseRecipeDuration(value: string | null | undefined): number | undefined {
  if (!value) {
    return undefined
  }

  const normalized = cleanText(value).toLowerCase()
  const isoMatch = normalized.match(/^p(?:\d+d)?t(?:(\d+)h)?(?:(\d+)m)?$/i)

  if (isoMatch) {
    const hours = Number.parseInt(isoMatch[1] ?? '0', 10)
    const minutes = Number.parseInt(isoMatch[2] ?? '0', 10)
    return hours * 60 + minutes
  }

  const rangeMatch = normalized.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:min|minute|minuten)/)
  if (rangeMatch) {
    return Number.parseInt(rangeMatch[2] ?? '0', 10)
  }

  const hourMinuteMatch = normalized.match(/(?:(\d+)\s*(?:u|uur|h))\s*(?:(\d+)\s*(?:min|minute|minuten))?/)
  if (hourMinuteMatch) {
    const hours = Number.parseInt(hourMinuteMatch[1] ?? '0', 10)
    const minutes = Number.parseInt(hourMinuteMatch[2] ?? '0', 10)
    return hours * 60 + minutes
  }

  const minuteMatch = normalized.match(/(\d+)\s*(?:min|minute|minuten)/)
  if (minuteMatch) {
    return Number.parseInt(minuteMatch[1] ?? '0', 10)
  }

  return undefined
}

export function parseIngredientLine(value: string): RecipeIngredientDraft {
  const rawText = cleanText(value)
  const quantityMatch = rawText.match(/^([¼½¾⅓⅔⅛⅜⅝⅞]|\d+\/\d+|\d+(?:[,.]\d+)?)\s*(.*)$/u)

  if (!quantityMatch) {
    return { rawText, name: rawText }
  }

  const quantity = parseQuantity(quantityMatch[1] ?? '')
  const remainder = cleanText(quantityMatch[2] ?? '')

  if (quantity === undefined || !remainder) {
    return { rawText, name: rawText }
  }

  const [firstToken = '', ...remainingTokens] = remainder.split(' ')
  const normalizedUnit = UNIT_ALIASES.get(firstToken.toLowerCase())

  if (normalizedUnit) {
    const name = cleanText(remainingTokens.join(' ')) || remainder
    return { rawText, quantity, unit: normalizedUnit, name }
  }

  return { rawText, quantity, name: remainder }
}

function parseQuantity(value: string): number | undefined {
  if (value in FRACTION_VALUES) {
    return FRACTION_VALUES[value]
  }

  if (value.includes('/')) {
    const [numeratorText, denominatorText] = value.split('/')
    const numerator = Number.parseFloat(numeratorText ?? '')
    const denominator = Number.parseFloat(denominatorText ?? '')
    return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0
      ? numerator / denominator
      : undefined
  }

  return parseLocalizedNumber(value)
}