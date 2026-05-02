import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseRecipeHtml } from '../../server/services/recipe-ingestion/recipeScraper'

const fixturePath = (name: string) => fileURLToPath(new URL(`../../example_html/${name}`, import.meta.url))

async function fixture(name: string): Promise<string> {
  return readFile(fixturePath(name), 'utf8')
}

describe('Dagelijkse Kost scraper', () => {
  it('parses a Dagelijkse Kost JSON-LD recipe with prep, cook, and total time', async () => {
    const result = parseRecipeHtml(await fixture('dagelijkse_kost_recipe.html'), 'https://dagelijksekost.vrt.be/gerechten/kotelet-jonge-wortelen-puree-tuinkers-tijmsaus')

    expect(result.draft.source.host).toBe('dagelijksekost.vrt.be')
    expect(result.draft.title).toContain('Jeroen Meus maakt een goudbruin gebakken varkenskotelet')
    expect(result.draft.servings).toBe(4)
    expect(result.draft.prepTimeMinutes).toBe(20)
    expect(result.draft.cookTimeMinutes).toBe(40)
    expect(result.draft.totalTimeMinutes).toBe(60)
    expect(result.draft.ingredients).toContainEqual(expect.objectContaining({ rawText: '800 gram Loskokende aardappelen' }))
    expect(result.draft.steps[0].text).toBe('Snij de aardappelen in grote stukken. Kook ze gaar in gezouten water.')
  })
})
