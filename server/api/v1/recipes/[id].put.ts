import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { getDb } from '../../../db/sqlite'
import { useTraceId } from '../../../middleware/01.trace-context'
import { updateRecipe } from '../../../services/recipe-catalog/recipeRepository'
import { recipeUpdatePayloadSchema } from '../../../services/recipe-catalog/recipeSchemas'
import { handleRecipeUnexpected, toRecipeHttpError } from '../../../utils/recipeErrors'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')?.trim()
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Recipe id is required.' })
    }

    const parsedPayload = recipeUpdatePayloadSchema.safeParse(await readBody(event))

    if (!parsedPayload.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid recipe payload.', data: parsedPayload.error.flatten() })
    }

    const result = await updateRecipe(getDb(), id, parsedPayload.data)
    if (!result.ok) {
      throw createError(toRecipeHttpError(result.error))
    }
    return result.value
  }
  catch (err) {
    handleRecipeUnexpected(err, 'recipes', 'update recipe', useTraceId(event))
  }
})
