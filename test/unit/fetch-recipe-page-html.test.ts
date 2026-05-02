import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { detectPublisherAuthWall } from '../../server/services/recipe-ingestion/fetchRecipePageHtml'

const fixturePath = (name: string) => fileURLToPath(new URL(`../../example_html/${name}`, import.meta.url))

describe('detectPublisherAuthWall', () => {
  it('is true when the final URL is on a known Roularta auth host', async () => {
    const html = await readFile(fixturePath('roularta_login_wall_min.html'), 'utf8')
    expect(detectPublisherAuthWall(html, 'https://sso.roularta.be/login')).toBe(true)
    expect(detectPublisherAuthWall(html, 'https://token.roularta.be/oauth/v1/authorize')).toBe(true)
  })

  it('is true when the page title indicates login and there is no Recipe JSON-LD', async () => {
    const html = await readFile(fixturePath('roularta_login_wall_min.html'), 'utf8')
    expect(detectPublisherAuthWall(html, 'https://www.libelle-lekker.be/bekijk-recept/92962/example')).toBe(true)
  })

  it('is false for a normal Libelle recipe fixture with a recipe URL', async () => {
    const html = await readFile(fixturePath('libelle_lekker_recipe.html'), 'utf8')
    expect(
      detectPublisherAuthWall(
        html,
        'https://www.libelle-lekker.be/bekijk-recept/93161/gevulde-wraps-met-gehakt-mais-en-champignons',
      ),
    ).toBe(false)
  })

  it('is false when title looks like login but Recipe JSON-LD is present (avoid false positive)', async () => {
    const html = `<!DOCTYPE html><html><head><title>Inloggen</title>
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Recipe","name":"X","recipeIngredient":["1"]}</script>
      </head><body></body></html>`
    expect(detectPublisherAuthWall(html, 'https://www.example.com/page')).toBe(false)
  })
})
