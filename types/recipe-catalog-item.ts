/**
 * API shape for recipe catalog list and detail; kept in /types for shared use by
 * server repository and Nuxt pages (single definition).
 */
export interface RecipeCatalogItem {
  id: string
  title: string
  description?: string
  sourceUrl?: string
  sourceHost?: string
  imageUrl?: string
  servings?: number
  prepTimeMinutes?: number
  cookTimeMinutes?: number
  totalTimeMinutes?: number
  difficulty?: string
  categories: string[]
  tags: string[]
  ingredients: Array<{
    id: string
    position: number
    rawText: string
    name: string
    quantity?: number
    unit?: string
  }>
  steps: Array<{
    id: string
    position: number
    text: string
  }>
  createdAt: string
  updatedAt: string
}
