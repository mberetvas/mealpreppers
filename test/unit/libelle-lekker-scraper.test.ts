import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseRecipeHtml } from '../../server/services/recipe-ingestion/recipeScraper'

const fixturePath = (name: string) => fileURLToPath(new URL(`../../example_html/${name}`, import.meta.url))

async function fixture(name: string): Promise<string> {
  return readFile(fixturePath(name), 'utf8')
}

describe('Libelle Lekker scraper', () => {
  it('prefers structured ingredient groups over loose JSON-LD ingredients', async () => {
    const result = parseRecipeHtml(await fixture('libelle_lekker_recipe.html'), 'https://www.libelle-lekker.be/bekijk-recept/93161/gevulde-wraps-met-gehakt-mais-en-champignons')

    expect(result.draft.source.host).toBe('libelle-lekker.be')
    expect(result.draft.title).toBe('Gevulde wraps met gehakt, maïs en champignons')
    expect(result.draft.totalTimeMinutes).toBe(25)
    expect(result.draft.ingredients[0]).toMatchObject({ quantity: 8, name: "tortilla's" })
    expect(result.draft.ingredients[1]).toMatchObject({ quantity: 500, unit: 'g', name: 'gemengd gehakt' })
    expect(result.draft.steps).toHaveLength(4)
  })
})
