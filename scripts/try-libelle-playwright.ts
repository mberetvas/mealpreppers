import { load } from 'cheerio'
import { closeLibellePlaywrightBrowser, fetchLibelleRecipePagePlaywright } from '../server/services/recipe-ingestion/fetchLibelleRecipePagePlaywright'
import { findRecipeJsonLd } from '../server/services/recipe-ingestion/scraperUtils'

const targetUrl = 'https://www.libelle-lekker.be/bekijk-recept/92962/boerenkoolsalade-met-spruitjes-peer-en-pancetta'

async function main(): Promise<void> {
  try {
    const result = await fetchLibelleRecipePagePlaywright(targetUrl)
    const document = load(result.html)
    const title = document('title').first().text().trim()
    const hasRecipeJsonLd = findRecipeJsonLd(document) !== undefined

    console.log(JSON.stringify({
      requestedUrl: targetUrl,
      finalUrl: result.finalUrl,
      status: result.status,
      title,
      titleContainsInloggen: /\binloggen\b/i.test(title),
      hasRecipeJsonLd,
    }, null, 2))
  }
  finally {
    await closeLibellePlaywrightBrowser()
  }
}

await main()
