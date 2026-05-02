import { describe, expect, it } from 'vitest'
import { parseRecipeHtml } from '../../server/services/recipe-ingestion/recipeScraper'

describe('JSON-LD recipeInstructions HowTo.step', () => {
  it('extracts steps from schema.org HowTo wrapped instructions', () => {
    const html = `<!DOCTYPE html><html><head>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": "HowTo step test",
        "recipeInstructions": {
          "@type": "HowTo",
          "step": [
            { "@type": "HowToStep", "text": "Do the first thing." },
            { "@type": "HowToStep", "text": "Do the second thing." }
          ]
        },
        "recipeIngredient": ["100 g flour"]
      }
      </script>
      </head><body></body></html>`

    const { draft } = parseRecipeHtml(html, 'https://www.colruyt.be/recipes/howto-step-test')
    expect(draft.steps).toHaveLength(2)
    expect(draft.steps[0]?.text).toContain('first')
    expect(draft.steps[1]?.text).toContain('second')
  })
})
