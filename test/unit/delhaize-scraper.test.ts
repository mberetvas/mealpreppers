import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseRecipeHtml } from '../../server/services/recipe-ingestion/recipeScraper'

const fixturePath = (name: string) => fileURLToPath(new URL(`../../example_html/${name}`, import.meta.url))

async function fixture(name: string): Promise<string> {
  return readFile(fixturePath(name), 'utf8')
}

describe('Delhaize scraper', () => {
  it('uses embedded recipe data when JSON-LD instructions are incomplete', async () => {
    const result = parseRecipeHtml(await fixture('delhaize_recipe.html'), 'https://www.delhaize.be/nl/recepten/receptDetails/Rundsgehaktballetjes-met-pijnboompitten-gedroogde-tomaten-en-parmigiano/r/ad352086a4334752ad5b7f04813332ae')

    expect(result.draft.source.host).toBe('delhaize.be')
    expect(result.draft.title).toBe('Rundsgehaktballetjes met pijnboompitten, gedroogde tomaten en parmigiano')
    expect(result.draft.servings).toBe(16)
    expect(result.draft.totalTimeMinutes).toBe(120)
    expect(result.draft.difficulty).toBe('Makkelijk')
    expect(result.draft.ingredients[0]).toMatchObject({ quantity: 1.4, unit: 'kg', name: 'bio gekruid rundsgehakt' })
    expect(result.draft.steps).toHaveLength(0)
    expect(result.warnings).toContain('No preparation steps found for this recipe.')
  })
})
