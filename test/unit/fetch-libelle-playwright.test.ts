import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPage, mockBrowser, mockChromium } = vi.hoisted(() => ({
  mockPage: {
    goto: vi.fn(),
    content: vi.fn(),
    url: vi.fn(),
    close: vi.fn(),
  },
  mockBrowser: {
    isConnected: vi.fn(),
    newPage: vi.fn(),
    close: vi.fn(),
  },
  mockChromium: {
    launch: vi.fn(),
  },
}))

vi.mock('playwright', () => ({
  chromium: mockChromium,
  errors: {
    TimeoutError: class TimeoutError extends Error {},
  },
}))

import {
  closeLibellePlaywrightBrowser,
  fetchLibelleRecipePagePlaywright,
} from '../../server/services/recipe-ingestion/fetchLibelleRecipePagePlaywright'

describe('fetchLibelleRecipePagePlaywright', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockBrowser.isConnected.mockReturnValue(true)
    mockBrowser.newPage.mockResolvedValue(mockPage)
    mockBrowser.close.mockResolvedValue(undefined)
    mockChromium.launch.mockResolvedValue(mockBrowser)

    mockPage.goto.mockResolvedValue({ status: () => 200 })
    mockPage.content.mockResolvedValue('<html><head><title>Recipe</title></head><body></body></html>')
    mockPage.url.mockReturnValue('https://www.libelle-lekker.be/bekijk-recept/92962/demo')
    mockPage.close.mockResolvedValue(undefined)

    await closeLibellePlaywrightBrowser()
  })

  it('returns html, finalUrl and status from Playwright navigation', async () => {
    const result = await fetchLibelleRecipePagePlaywright('https://www.libelle-lekker.be/bekijk-recept/92962/demo')

    expect(mockChromium.launch).toHaveBeenCalledTimes(1)
    expect(mockPage.goto).toHaveBeenCalledWith(
      'https://www.libelle-lekker.be/bekijk-recept/92962/demo',
      expect.objectContaining({ waitUntil: 'domcontentloaded', timeout: 30000 }),
    )
    expect(mockPage.close).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      html: '<html><head><title>Recipe</title></head><body></body></html>',
      finalUrl: 'https://www.libelle-lekker.be/bekijk-recept/92962/demo',
      status: 200,
    })
  })

  it('reuses the connected browser between calls', async () => {
    await fetchLibelleRecipePagePlaywright('https://www.libelle-lekker.be/bekijk-recept/92962/first')
    await fetchLibelleRecipePagePlaywright('https://www.libelle-lekker.be/bekijk-recept/92962/second')

    expect(mockChromium.launch).toHaveBeenCalledTimes(1)
    expect(mockBrowser.newPage).toHaveBeenCalledTimes(2)
  })

  it('closes the shared browser when cleanup is called', async () => {
    await fetchLibelleRecipePagePlaywright('https://www.libelle-lekker.be/bekijk-recept/92962/demo')
    mockBrowser.close.mockClear()
    await closeLibellePlaywrightBrowser()

    expect(mockBrowser.close).toHaveBeenCalledTimes(1)
  })
})
