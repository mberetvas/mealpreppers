import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseRecipeHtml } from '../../server/services/recipe-ingestion/recipeScraper'

const fixturePath = (name: string) => fileURLToPath(new URL(`../../example_html/${name}`, import.meta.url))

async function fixture(name: string): Promise<string> {
  return readFile(fixturePath(name), 'utf8')
}

describe('15gram scraper', () => {
  it('parses a 15gram microdata recipe into an editable draft', async () => {
    const result = parseRecipeHtml(await fixture('15gram_recipe.html'), 'https://15gram.be/recepten/speltbowl-met-gegrilde-kip-en-geroosterde-groenten')

    expect(result.draft.source.host).toBe('15gram.be')
    expect(result.draft.title).toBe('Speltbowl met gegrilde kip en geroosterde groenten')
    expect(result.draft.servings).toBe(2)
    expect(result.draft.cookTimeMinutes).toBe(35)
    expect(result.draft.ingredients).toHaveLength(14)
    expect(result.draft.ingredients[2]).toMatchObject({ quantity: 0.5, unit: 'bussel', name: 'radijs' })
    expect(result.draft.steps).toHaveLength(7)
    expect(result.draft.steps[0].text).toContain('Verwarm de oven voor op 200°C')
    expect(result.draft.categories).toEqual([])
    expect(result.draft.tags).toEqual(['bowl', 'Chef Caroline', 'Foodbag', 'gezond'])
  })

  it('maps recipeCategory and recipeCuisine to categories and keywords to tags', () => {
    const html = `
      <div id="recipe-detail" itemscope itemtype="https://schema.org/Recipe">
        <div id="tags">
          <ul class="no-bullet clearfix">
            <li><a href="https://15gram.be/tag/hoofdgerecht"><span itemprop="recipeCategory">hoofdgerecht</span></a></li>
            <li><a href="https://15gram.be/tag/stoofpot"><span itemprop="keywords">stoofpot</span></a></li>
            <li><a href="https://15gram.be/tag/spaans"><span itemprop="recipeCuisine">Spaans</span></a></li>
          </ul>
        </div>
      </div>`
    const result = parseRecipeHtml(html, 'https://15gram.be/recepten/stoofschotel-met-kip-en-chorizo')

    expect(result.draft.categories).toEqual(['hoofdgerecht', 'Spaans'])
    expect(result.draft.tags).toEqual(['stoofpot'])
  })
})
