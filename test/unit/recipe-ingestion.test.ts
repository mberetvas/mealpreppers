import { describe, expect, it } from 'vitest'
import { isSupportedRecipeUrl } from '../../server/services/recipe-ingestion/recipeScraper'
import { parseIngredientLine, parseRecipeDuration } from '../../server/services/recipe-ingestion/normalizers'

describe('recipe ingestion normalizers', () => {
  it('normalizes ISO durations and recipe-site text ranges to minutes', () => {
    expect(parseRecipeDuration('PT35M')).toBe(35)
    expect(parseRecipeDuration('PT2H')).toBe(120)
    expect(parseRecipeDuration('PT1H30M')).toBe(90)
    expect(parseRecipeDuration('30-60 min.')).toBe(60)
  })

  it('keeps raw ingredient text while extracting quantity, unit, and name when possible', () => {
    expect(parseIngredientLine('½ bussel radijs')).toMatchObject({
      rawText: '½ bussel radijs',
      quantity: 0.5,
      unit: 'bussel',
      name: 'radijs',
    })
    expect(parseIngredientLine('1,4 kg bio gekruid rundsgehakt')).toMatchObject({
      quantity: 1.4,
      unit: 'kg',
      name: 'bio gekruid rundsgehakt',
    })
    expect(parseIngredientLine('zout')).toMatchObject({
      rawText: 'zout',
      name: 'zout',
    })
  })
})

describe('recipe source allow-list', () => {
  it('accepts supported recipe hosts and rejects unsupported or local URLs', () => {
    expect(isSupportedRecipeUrl('https://15gram.be/recepten/speltbowl')).toBe(true)
    expect(isSupportedRecipeUrl('https://www.colruyt.be/nl/recepten/risotto')).toBe(true)
    expect(isSupportedRecipeUrl('https://dagelijksekost.vrt.be/gerechten/kotelet')).toBe(true)
    expect(isSupportedRecipeUrl('https://www.delhaize.be/nl/recepten/receptDetails/demo')).toBe(true)
    expect(isSupportedRecipeUrl('https://www.libelle-lekker.be/bekijk-recept/93161/demo')).toBe(true)
    expect(isSupportedRecipeUrl('https://example.com/recipe')).toBe(false)
    expect(isSupportedRecipeUrl('http://localhost:54321/private')).toBe(false)
  })
})