import { describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils'

describe('recipe preview API (Nuxt)', async () => {
  await setup({
    server: true,
    browser: false,
  })

  it('returns 400 for invalid preview request body', async () => {
    await expect(
      $fetch('/api/v1/recipes/preview', {
        method: 'POST',
        body: { url: 'not-a-valid-url' },
      }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})
