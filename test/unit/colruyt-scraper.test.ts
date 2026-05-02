import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseRecipeHtml } from '../../server/services/recipe-ingestion/recipeScraper'

const fixturePath = (name: string) => fileURLToPath(new URL(`../../example_html/${name}`, import.meta.url))

async function fixture(name: string): Promise<string> {
  return readFile(fixturePath(name), 'utf8')
}

describe('Colruyt scraper', () => {
  it('parses a Colruyt JSON-LD recipe and filters empty preparation steps', async () => {
    const result = parseRecipeHtml(await fixture('colruyt_recipe.html'), 'https://www.colruyt.be/nl/recepten/risotto-met-zalm-en-asperges')

    expect(result.draft.source.host).toBe('colruyt.be')
    expect(result.draft.title).toBe('Risotto met zalm en asperges')
    expect(result.draft.servings).toBe(4)
    expect(result.draft.totalTimeMinutes).toBe(30)
    expect(result.draft.ingredients[0].rawText).toBe('500 g gemarineerde zalm met sriracha (diepvries)')
    expect(result.draft.steps[0].text).toBe('Los het bouillonblokje in het hete water. Snipper de rode uien fijn.')
  })
})
