import { describe, expect, it } from 'vitest'
import { toPlanningHttpError } from '../../server/utils/planningErrors'

describe('toPlanningHttpError', () => {
  it('maps invalid recipe ids to a 400 response payload', () => {
    const payload = toPlanningHttpError({
      kind: 'invalid_recipe_ids',
      message: 'One or more recipe ids are not in the catalog.',
      missingRecipeIds: ['a', 'b'],
    })

    expect(payload).toEqual({
      statusCode: 400,
      statusMessage: 'One or more recipe ids are not in the catalog.',
      data: { missingRecipeIds: ['a', 'b'] },
    })
  })

  it('maps not found to a 404 response payload', () => {
    const payload = toPlanningHttpError({
      kind: 'not_found',
      entity: 'week_template',
      message: 'Week template not found.',
    })

    expect(payload).toEqual({
      statusCode: 404,
      statusMessage: 'Week template not found.',
    })
  })

  it('maps storage errors to a 500 response payload', () => {
    const payload = toPlanningHttpError({
      kind: 'storage_error',
      message: 'Month plans could not be loaded.',
    })

    expect(payload).toEqual({
      statusCode: 500,
      statusMessage: 'Month plans could not be loaded.',
    })
  })
})
