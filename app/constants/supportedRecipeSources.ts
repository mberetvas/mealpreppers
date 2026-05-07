/** Canonical homepage URL for each supported recipe scraping source. */
export interface RecipeSourceEntry {
  host: string
  url: string
}

/** Ordered list of supported recipe websites with their canonical homepage URLs. */
export const SUPPORTED_RECIPE_SOURCES: RecipeSourceEntry[] = [
  { host: '15gram.be', url: 'https://www.15gram.be' },
  { host: 'colruyt.be', url: 'https://www.colruyt.be/nl/recepten' },
  { host: 'dagelijksekost.vrt.be', url: 'https://dagelijksekost.vrt.be' },
  { host: 'delhaize.be', url: 'https://www.delhaize.be/nl/recepten' },
  { host: 'libelle-lekker.be', url: 'https://www.libelle-lekker.be' },
]
