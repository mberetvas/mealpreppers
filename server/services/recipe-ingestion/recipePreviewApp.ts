/**
 * Application entry for recipe URL preview: host-specific fetch, parse, and enrichment.
 * HTTP adapters validate the body, call `previewRecipeFromUrl`, and map domain errors to responses.
 */
export type { FetchRecipePageForPreview, PreviewRecipeFromUrlDeps } from './recipePreview/previewRecipeFromUrl'
export { previewRecipeFromUrl } from './recipePreview/previewRecipeFromUrl'
