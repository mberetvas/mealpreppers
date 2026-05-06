import { describe, expect, it } from 'vitest'
import { toRecipeHttpError } from '../../server/utils/recipeErrors'

describe('toRecipeHttpError', () => {
  it('maps not found to a 404 response payload', () => {
    const payload = toRecipeHttpError({
      kind: 'not_found',
      message: 'Recipe not found.',
    })

    expect(payload).toEqual({
      statusCode: 404,
      statusMessage: 'Recipe not found.',
    })
  })

  it('maps storage errors to a 500 response payload', () => {
    const payload = toRecipeHttpError({
      kind: 'storage_error',
      message: 'Recipes could not be loaded.',
    })

    expect(payload).toEqual({
      statusCode: 500,
      statusMessage: 'Recipes could not be loaded.',
    })
  })
})
