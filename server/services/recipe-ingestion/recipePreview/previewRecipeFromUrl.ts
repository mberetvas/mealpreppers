import type { FetchRecipePageHtmlResult } from '../fetchRecipePageHtml'
import { detectPublisherAuthWall, fetchRecipePageHtml } from '../fetchRecipePageHtml'
import { fetchLibelleRecipePagePlaywright } from '../fetchLibelleRecipePagePlaywright'
import { canonicalRecipeHost, isSupportedRecipeUrl, parseRecipeHtml } from '../recipeScraper'
import type { RecipePreviewResponse } from '../../../../types/recipe-preview'
import { enrichDagelijkseKostSteps } from './enrichDagelijkseKostSteps'
import {
  RecipePageFetchError,
  RecipePublisherAuthWallError,
  UnsupportedRecipeSourceError,
} from './recipePreviewErrors'

const LIBELLE_HOST = 'libelle-lekker.be' as const

export type FetchRecipePageForPreview = (url: string) => Promise<FetchRecipePageHtmlResult>

export interface PreviewRecipeFromUrlDeps {
  fetchRecipePage: FetchRecipePageForPreview
  enrichDagelijkseKost: typeof enrichDagelijkseKostSteps
}

/** Libelle uses Playwright; other supported hosts use browser-like HTTP fetch. */
function defaultFetchRecipePage(url: string): Promise<FetchRecipePageHtmlResult> {
  const host = canonicalRecipeHost(url)
  return host === LIBELLE_HOST
    ? fetchLibelleRecipePagePlaywright(url)
    : fetchRecipePageHtml(url)
}

const defaultDeps: PreviewRecipeFromUrlDeps = {
  fetchRecipePage: defaultFetchRecipePage,
  enrichDagelijkseKost: enrichDagelijkseKostSteps,
}

/**
 * Fetches a recipe URL, parses HTML, and applies host-specific enrichment (e.g. Dagelijkse Kost steps).
 */
export async function previewRecipeFromUrl(
  url: string,
  deps: Partial<PreviewRecipeFromUrlDeps> = {},
): Promise<RecipePreviewResponse> {
  if (!isSupportedRecipeUrl(url)) {
    throw new UnsupportedRecipeSourceError()
  }

  const { fetchRecipePage, enrichDagelijkseKost } = { ...defaultDeps, ...deps }
  const { html, finalUrl, status } = await fetchRecipePage(url)

  if (status < 200 || status >= 300) {
    throw new RecipePageFetchError()
  }

  if (detectPublisherAuthWall(html, finalUrl)) {
    throw new RecipePublisherAuthWallError({
      requestedUrl: url,
      finalUrl,
      status,
    })
  }

  const { draft, warnings: initialWarnings } = parseRecipeHtml(html, url)
  const warnings = [...initialWarnings]

  await enrichDagelijkseKost(draft, html, warnings)

  return { draft, warnings }
}
