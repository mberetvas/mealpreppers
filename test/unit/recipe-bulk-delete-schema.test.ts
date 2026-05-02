import { describe, expect, it } from 'vitest'
import { recipeBulkDeleteRequestSchema } from '../../server/services/recipe-catalog/recipeSchemas'

describe('recipeBulkDeleteRequestSchema', () => {
  it('accepts a non-empty uuid array within limit', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    const parsed = recipeBulkDeleteRequestSchema.safeParse({ ids: [id] })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.ids).toEqual([id])
    }
  })

  it('rejects empty ids array', () => {
    const parsed = recipeBulkDeleteRequestSchema.safeParse({ ids: [] })
    expect(parsed.success).toBe(false)
  })

  it('rejects more than 200 ids', () => {
    const fakeUuid = '550e8400-e29b-41d4-a716-446655440000'
    const ids = Array.from({ length: 201 }, () => fakeUuid)
    const parsed = recipeBulkDeleteRequestSchema.safeParse({ ids })
    expect(parsed.success).toBe(false)
  })

  it('rejects non-uuid strings', () => {
    const parsed = recipeBulkDeleteRequestSchema.safeParse({ ids: ['not-a-uuid'] })
    expect(parsed.success).toBe(false)
  })
})
