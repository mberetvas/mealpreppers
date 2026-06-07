import { createError, defineEventHandler, readBody } from 'h3'
import { getDb } from '../../../db/sqlite'
import { useTraceId } from '../../../middleware/01.trace-context'
import { createRecipe } from '../../../services/recipe-catalog/recipeRepository'
import { recipeCreatePayloadSchema } from '../../../services/recipe-catalog/recipeSchemas'
import { handleRecipeUnexpected, toRecipeHttpError } from '../../../utils/recipeErrors'

export default defineEventHandler(async (event) => {
  try {
    const parsedPayload = recipeCreatePayloadSchema.safeParse(await readBody(event))

    if (!parsedPayload.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid recipe payload.', data: parsedPayload.error.flatten() })
    }

    const result = await createRecipe(getDb(), parsedPayload.data)
    if (!result.ok) {
      throw createError(toRecipeHttpError(result.error))
    }
    return result.value
  }
  catch (err) {
    handleRecipeUnexpected(err, 'recipes', 'create recipe', useTraceId(event))
  }
})
