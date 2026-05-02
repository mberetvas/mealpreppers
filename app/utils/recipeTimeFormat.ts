import type { RecipeCatalogItem } from '../../types/recipe-catalog-item'

function sumOptional(first: number | undefined, second: number | undefined): number | undefined {
  if (first === undefined && second === undefined) {
    return undefined
  }

  return (first ?? 0) + (second ?? 0)
}

/** Total / prep + cook time label for catalog and detail. */
export function formatRecipeTime(recipe: RecipeCatalogItem): string | undefined {
  const minutes = recipe.totalTimeMinutes ?? sumOptional(recipe.prepTimeMinutes, recipe.cookTimeMinutes)
  return minutes === undefined ? undefined : `${minutes} min`
}

export function primaryRecipeMeta(recipe: RecipeCatalogItem): string[] {
  return [
    formatRecipeTime(recipe),
    recipe.servings ? `${recipe.servings} servings` : undefined,
    recipe.difficulty,
  ].filter((item): item is string => Boolean(item))
}
