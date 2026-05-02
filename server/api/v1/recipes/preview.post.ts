import { isSupportedRecipeUrl, parseRecipeHtml } from '../../../services/recipe-ingestion/recipeScraper'
import { recipePreviewRequestSchema } from '../../../services/recipe-catalog/recipeSchemas'

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
  return parseRecipeHtml(html, body.url)
})