import { chromium, errors, type Browser } from 'playwright'
import type { FetchRecipePageHtmlResult } from './fetchRecipePageHtml'
import { RecipeBrowserAutomationError } from './recipePreview/recipePreviewErrors'

let sharedBrowser: Browser | undefined
let browserPromise: Promise<Browser> | undefined

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser?.isConnected()) {
    return sharedBrowser
  }

  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true })
      .then((browser) => {
        sharedBrowser = browser
        return browser
      })
      .finally(() => {
        browserPromise = undefined
      })
  }

  return browserPromise
}

/**
 * Fetches a Libelle recipe page using real Chromium navigation to better match
 * what a normal browser receives on Roularta-hosted pages.
 */
export async function fetchLibelleRecipePagePlaywright(url: string): Promise<FetchRecipePageHtmlResult> {
  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })

    return {
      html: await page.content(),
      finalUrl: page.url(),
      status: response?.status() ?? 200,
    }
  }
  catch (error) {
    const timedOut = error instanceof errors.TimeoutError
    const timeoutHint = timedOut ? ' (navigation timed out)' : ''
    throw new RecipeBrowserAutomationError(
      `The recipe page could not be fetched with browser automation${timeoutHint}.`,
      timedOut,
    )
  }
  finally {
    await page.close()
  }
}

export async function closeLibellePlaywrightBrowser(): Promise<void> {
  if (sharedBrowser && sharedBrowser.isConnected()) {
    await sharedBrowser.close()
  }
  sharedBrowser = undefined
}
