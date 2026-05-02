import { load } from 'cheerio'
import { findRecipeJsonLd } from './scraperUtils'

/** Hostnames used by Roularta / Libelle SSO when the recipe URL is not served as public HTML. */
const ROULARTA_AUTH_HOSTS = new Set([
  'token.roularta.be',
  'sso.roularta.be',
  'ciam.roularta.be',
])

const LOGIN_TITLE_PATTERN = /\binloggen\b/i

export interface FetchRecipePageHtmlResult {
  html: string
  finalUrl: string
  status: number
}

/**
 * Fetches a recipe detail page using headers similar to a desktop Chromium
 * navigation, to reduce bot-style blocking on some publishers (e.g. Roularta).
 */
export async function fetchRecipePageHtml(url: string): Promise<FetchRecipePageHtmlResult> {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: browserLikeRecipePageHeaders(),
  })

  const html = await response.text()
  return {
    html,
    finalUrl: response.url,
    status: response.status,
  }
}

export function browserLikeRecipePageHeaders(): HeadersInit {
  return {
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'accept-language': 'nl-BE,nl;q=0.9,en;q=0.8',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    // Chrome 131 on Windows — stable desktop UA pattern for recipe pages
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  }
}

/**
 * Returns true when the response looks like a publisher login/SSO wall rather
 * than a public recipe document (conservative heuristics).
 */
export function detectPublisherAuthWall(html: string, finalUrl: string): boolean {
  let hostname: string
  try {
    hostname = new URL(finalUrl).hostname.toLowerCase()
  }
  catch {
    return false
  }

  if (ROULARTA_AUTH_HOSTS.has(hostname)) {
    return true
  }

  const document = load(html)
  const title = document('title').first().text().trim()
  const hasRecipeJsonLd = findRecipeJsonLd(document) !== undefined

  if (hasRecipeJsonLd) {
    return false
  }

  if (LOGIN_TITLE_PATTERN.test(title)) {
    return true
  }

  return false
}
