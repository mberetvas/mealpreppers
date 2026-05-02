import consola from 'consola'
import { isSupportedRecipeUrl, parseRecipeHtml } from '../../../services/recipe-ingestion/recipeScraper'
import { detectPublisherAuthWall, fetchRecipePageHtml } from '../../../services/recipe-ingestion/fetchRecipePageHtml'
import { toRecipeSteps } from '../../../services/recipe-ingestion/scraperUtils'
import { recipePreviewRequestSchema } from '../../../services/recipe-catalog/recipeSchemas'
import {
  extractDagelijksekostRecipeDocumentIdFromHtml,
  extractDagelijksekostRecipeDocumentIdFromImageUrl,
  fetchDagelijksekostInstructions,
} from '../../../services/recipe-ingestion/dagelijksekostFirestore'

const previewLogger = consola.withTag('recipe-preview')

export default defineEventHandler(async (event) => {
  const parsedBody = recipePreviewRequestSchema.safeParse(await readBody(event))

  if (!parsedBody.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid recipe preview request.', data: parsedBody.error.flatten() })
  }

  const body = parsedBody.data

  if (!isSupportedRecipeUrl(body.url)) {
    throw createError({ statusCode: 400, statusMessage: 'This recipe source is not supported.' })
  }

  const { html, finalUrl, status } = await fetchRecipePageHtml(body.url)

  if (status < 200 || status >= 300) {
    throw createError({ statusCode: 502, statusMessage: 'The recipe page could not be fetched.' })
  }

  if (detectPublisherAuthWall(html, finalUrl)) {
    previewLogger.warn('Recipe preview blocked by publisher auth wall', {
      requestedUrl: body.url,
      finalUrl,
      status,
    })
    throw createError({
      statusCode: 422,
      statusMessage: 'The publisher returned a login page instead of the recipe. This importer only reads pages that are available without an account. Open the recipe in a private window: if it asks you to sign in, use manual entry or another source.',
    })
  }

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