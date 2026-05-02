import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  extractDagelijksekostRecipeDocumentIdFromHtml,
  extractDagelijksekostRecipeDocumentIdFromImageUrl,
  fetchDagelijksekostInstructions,
  parseFirestoreInstructionStrings,
} from '../../server/services/recipe-ingestion/dagelijksekostFirestore'
import { parseRecipeHtml } from '../../server/services/recipe-ingestion/recipeScraper'

const fixturePath = (name: string) => fileURLToPath(new URL(`../../example_html/${name}`, import.meta.url))

/**
 * JSON-LD on the page only lists 2 HowTo steps; full list comes from Firestore. Use in manual checks:
 * `POST /api/v1/recipes/preview` with `{"url":"..."}`.
 */
const DAGELIJKSE_KOST_FULL_STEPS_REGRESSION_URL =
  'https://dagelijksekost.vrt.be/gerechten/gebakken-kipfilet-met-roquefortsaus-gratin-van-pastinaak-en-veldsla'

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

describe('Dagelijkse Kost regression URL', () => {
  it('keeps the manual preview test URL for recipes that omit most steps in JSON-LD', () => {
    expect(DAGELIJKSE_KOST_FULL_STEPS_REGRESSION_URL).toBe(
      'https://dagelijksekost.vrt.be/gerechten/gebakken-kipfilet-met-roquefortsaus-gratin-van-pastinaak-en-veldsla',
    )
  })
})

describe('Dagelijkse Kost Firestore helpers', () => {
  const exampleJsonPath = (name: string) => fileURLToPath(new URL(`../../example_json/${name}`, import.meta.url))

  it('extracts document id from HTML containing a storage /recipes/{id}/ path', () => {
    const html = '<meta property="og:image" content="https://storage.googleapis.com/dagelijkse-kost-prod-public-landscape/recipes/Vm2v1KmqkIWJAcYLzcVO/1770986858509_1500x1125?token=1">'
    expect(extractDagelijksekostRecipeDocumentIdFromHtml(html)).toBe('Vm2v1KmqkIWJAcYLzcVO')
  })

  it('extracts document id from image URL', () => {
    expect(
      extractDagelijksekostRecipeDocumentIdFromImageUrl('https://storage.googleapis.com/.../recipes/Vm2v1KmqkIWJAcYLzcVO/x'),
    ).toBe('Vm2v1KmqkIWJAcYLzcVO')
  })

  it('parses 18 instruction strings from Firestore mapValue fixture (gebakken kipfilet regression shape)', async () => {
    const raw = await readFile(exampleJsonPath('dagelijkse_kost_firestore_instructions.json'), 'utf8')
    const node = JSON.parse(raw) as unknown
    const steps = parseFirestoreInstructionStrings(node)
    expect(steps).toBeDefined()
    expect(steps!.length).toBe(18)
    expect(steps![0]).toBe('Verwarm de oven voor op 180°C.')
    expect(steps![17]).toBe('Lepel de romige saus royaal over de kipfilets.')
  })

  it('fetches full instructions when Firestore REST body matches the fixture', async () => {
    const raw = await readFile(exampleJsonPath('dagelijkse_kost_firestore_instructions.json'), 'utf8')
    const fullInstructions = JSON.parse(raw) as { mapValue: { fields: Record<string, { stringValue: string }> } }
    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ fields: { instructions: fullInstructions } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    const out = await fetchDagelijksekostInstructions('Vm2v1KmqkIWJAcYLzcVO', mockFetch)
    expect(out?.length).toBe(18)
  })
})
