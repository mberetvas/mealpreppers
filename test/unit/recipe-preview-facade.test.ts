import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { enrichDagelijkseKostSteps } from '../../server/services/recipe-ingestion/recipePreview/enrichDagelijkseKostSteps'
import { previewRecipeFromUrl } from '../../server/services/recipe-ingestion/recipePreview/previewRecipeFromUrl'
import { parseRecipeHtml } from '../../server/services/recipe-ingestion/recipeScraper'
import {
  RecipePageFetchError,
  RecipePageParseError,
  RecipePublisherAuthWallError,
  UnsupportedRecipeSourceError,
} from '../../server/services/recipe-ingestion/recipePreview/recipePreviewErrors'

const fixturePath = (name: string) => fileURLToPath(new URL(`../../example_html/${name}`, import.meta.url))

async function fixture(name: string): Promise<string> {
  return readFile(fixturePath(name), 'utf8')
}

describe('previewRecipeFromUrl', () => {
  it('rejects unsupported hosts', async () => {
    await expect(previewRecipeFromUrl('https://example.com/recipe')).rejects.toBeInstanceOf(UnsupportedRecipeSourceError)
  })

  it('rejects non-https URLs', async () => {
    await expect(previewRecipeFromUrl('http://15gram.be/recepten/x')).rejects.toBeInstanceOf(UnsupportedRecipeSourceError)
  })

  it('fails when fetch returns a non-2xx status', async () => {
    await expect(
      previewRecipeFromUrl('https://15gram.be/recepten/demo', {
        fetchRecipePage: async () => ({
          html: '',
          finalUrl: 'https://15gram.be/recepten/demo',
          status: 503,
        }),
      }),
    ).rejects.toBeInstanceOf(RecipePageFetchError)
  })

  it('fails when parsed draft has no title or ingredients', async () => {
    await expect(
      previewRecipeFromUrl('https://15gram.be/recepten/demo', {
        fetchRecipePage: async () => ({
          html: '<html><head><title>Empty</title></head><body></body></html>',
          finalUrl: 'https://15gram.be/recepten/demo',
          status: 200,
        }),
      }),
    ).rejects.toBeInstanceOf(RecipePageParseError)
  })

  it('fails on publisher auth wall HTML', async () => {
    const html = await fixture('roularta_login_wall_min.html')
    await expect(
      previewRecipeFromUrl('https://www.libelle-lekker.be/bekijk-recept/1/demo', {
        fetchRecipePage: async () => ({
          html,
          finalUrl: 'https://token.roularta.be/',
          status: 200,
        }),
      }),
    ).rejects.toMatchObject({
      name: 'RecipePublisherAuthWallError',
      diagnostics: {
        requestedUrl: 'https://www.libelle-lekker.be/bekijk-recept/1/demo',
        finalUrl: 'https://token.roularta.be/',
        status: 200,
      },
    })
  })

  it('parses fetched HTML and returns draft and warnings', async () => {
    const html = await fixture('15gram_recipe.html')
    const url = 'https://15gram.be/recepten/speltbowl-met-geroosterde-groenten-en-hummus'
    const out = await previewRecipeFromUrl(url, {
      fetchRecipePage: async () => ({ html, finalUrl: url, status: 200 }),
      enrichDagelijkseKost: vi.fn(async () => {}),
    })

    expect(out.draft.title.length).toBeGreaterThan(0)
    expect(out.draft.source.host).toBe('15gram.be')
    expect(Array.isArray(out.warnings)).toBe(true)
  })

  it('runs Dagelijkse Kost enrichment after parse', async () => {
    const html = await fixture('dagelijkse_kost_recipe.html')
    const url = 'https://dagelijksekost.vrt.be/gerechten/kotelet-jonge-wortelen-puree-tuinkers-tijmsaus'
    const enrichDagelijkseKost = vi.fn(async () => {})

    await previewRecipeFromUrl(url, {
      fetchRecipePage: async () => ({ html, finalUrl: url, status: 200 }),
      enrichDagelijkseKost,
    })

    expect(enrichDagelijkseKost).toHaveBeenCalledTimes(1)
    const [draft, passedHtml, warnings] = enrichDagelijkseKost.mock.calls[0]!
    expect(passedHtml).toBe(html)
    expect(draft.source.host).toBe('dagelijksekost.vrt.be')
    expect(Array.isArray(warnings)).toBe(true)
  })
})

describe('enrichDagelijkseKostSteps', () => {
  it('replaces steps when Firestore returns more than parsed JSON-LD', async () => {
    const html = await fixture('dagelijkse_kost_recipe.html')
    const url = 'https://dagelijksekost.vrt.be/gerechten/kotelet-jonge-wortelen-puree-tuinkers-tijmsaus'
    const { draft } = parseRecipeHtml(html, url)
    const initialStepCount = draft.steps.length
    const longList = Array.from({ length: initialStepCount + 5 }, (_, i) => `Step ${i + 1}`)

    await enrichDagelijkseKostSteps(draft, html, [], async () => longList)

    expect(draft.steps.length).toBe(longList.length)
    expect(draft.steps[0]!.text).toBe('Step 1')
  })
})

describe('preview HTTP error mapping', () => {
  it('RecipePublisherAuthWallError carries 422 status', () => {
    const err = new RecipePublisherAuthWallError({
      requestedUrl: 'https://a',
      finalUrl: 'https://b',
      status: 200,
    })
    expect(err.statusCode).toBe(422)
  })
})
