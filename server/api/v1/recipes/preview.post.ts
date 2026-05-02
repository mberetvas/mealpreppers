import { isSupportedRecipeUrl, parseRecipeHtml } from '../../../services/recipe-ingestion/recipeScraper'
import { toRecipeSteps } from '../../../services/recipe-ingestion/scraperUtils'
import { recipePreviewRequestSchema } from '../../../services/recipe-catalog/recipeSchemas'
import {
  extractDagelijksekostRecipeDocumentIdFromHtml,
  extractDagelijksekostRecipeDocumentIdFromImageUrl,
  fetchDagelijksekostInstructions,
} from '../../../services/recipe-ingestion/dagelijksekostFirestore'

export default defineEventHandler(async (event) => {
  const parsedBody = recipePreviewRequestSchema.safeParse(await readBody(event))

  if (!parsedBody.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid recipe preview request.', data: parsedBody.error.flatten() })
  }

  const body = parsedBody.data

  if (!isSupportedRecipeUrl(body.url)) {
    throw createError({ statusCode: 400, statusMessage: 'This recipe source is not supported.' })
  }

  const response = await fetch(body.url, {
    redirect: 'follow',
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'Mealprepper recipe importer',
    },
  })

  if (!response.ok) {
    throw createError({ statusCode: 502, statusMessage: 'The recipe page could not be fetched.' })
  }

  const html = await response.text()
  const { draft, warnings: initialWarnings } = parseRecipeHtml(html, body.url)
  const warnings = [...initialWarnings]

  if (draft.source.host === 'dagelijksekost.vrt.be') {
    const documentId = extractDagelijksekostRecipeDocumentIdFromHtml(html)
      ?? extractDagelijksekostRecipeDocumentIdFromImageUrl(draft.imageUrl)

    if (documentId) {
      const instructionTexts = await fetchDagelijksekostInstructions(documentId)
      if (instructionTexts && instructionTexts.length > draft.steps.length) {
        draft.steps = toRecipeSteps(instructionTexts)
      }
      else if (draft.steps.length > 0 && draft.steps.length <= 2) {
        warnings.push('Could not load full preparation steps from Dagelijkse Kost; showing the short excerpt from this page.')
      }
    }
  }

  return { draft, warnings }
})