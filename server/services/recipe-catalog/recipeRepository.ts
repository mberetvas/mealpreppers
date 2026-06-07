import { randomUUID } from 'node:crypto'
import { desc, eq, inArray } from 'drizzle-orm'
import type { RecipeCatalogItem } from '../../../types/recipe-catalog-item'
import type { RecipeCatalogDb } from '../../db/sqlite'
import { recipeIngredients, recipeSteps, recipes } from '../../db/schema/recipeCatalog'
import type { RecipeCreatePayload, RecipeUpdatePayload } from './recipeSchemas'
import type { RecipeFailure, RecipeResult } from './recipeResult'
import { recipeFail, recipeOk } from './recipeResult'

export type { RecipeCatalogItem }

type RecipeRow = typeof recipes.$inferSelect
type IngredientRow = typeof recipeIngredients.$inferSelect
type StepRow = typeof recipeSteps.$inferSelect

function nowIso(): string {
  return new Date().toISOString()
}

/** Inserts a recipe with ingredients and optional steps. */
export async function createRecipe(db: RecipeCatalogDb, payload: RecipeCreatePayload): Promise<RecipeResult<RecipeCatalogItem>> {
  try {
    const recipeId = randomUUID()
    const timestamp = nowIso()

    const created = db.transaction((tx) => {
      tx.insert(recipes).values({
        id: recipeId,
        title: payload.title,
        description: payload.description ?? null,
        sourceUrl: payload.sourceUrl ?? null,
        sourceHost: payload.sourceHost ?? null,
        imageUrl: payload.imageUrl ?? null,
        servings: payload.servings ?? null,
        prepTimeMinutes: payload.prepTimeMinutes ?? null,
        cookTimeMinutes: payload.cookTimeMinutes ?? null,
        totalTimeMinutes: payload.totalTimeMinutes ?? null,
        difficulty: payload.difficulty ?? null,
        categories: payload.categories,
        tags: payload.tags,
        createdAt: timestamp,
        updatedAt: timestamp,
      }).run()

      const ingredientRows = payload.ingredients.map((ingredient, index) => ({
        id: randomUUID(),
        recipeId,
        position: index + 1,
        rawText: ingredient.rawText,
        name: ingredient.name,
        quantity: ingredient.quantity ?? null,
        unit: ingredient.unit ?? null,
        createdAt: timestamp,
      }))

      tx.insert(recipeIngredients).values(ingredientRows).run()

      const stepRows = payload.steps.map((step, index) => ({
        id: randomUUID(),
        recipeId,
        position: step.position ?? index + 1,
        text: step.text,
        createdAt: timestamp,
      }))

      if (stepRows.length > 0) {
        tx.insert(recipeSteps).values(stepRows).run()
      }

      return loadRecipeInTransaction(tx, recipeId)
    })

    if (!created) {
      return recipeFail(storageError(undefined, 'Recipe could not be saved.'))
    }

    return recipeOk(created)
  }
  catch (error) {
    return recipeFail(storageError(error instanceof Error ? error.message : undefined, 'Recipe could not be saved.'))
  }
}

/** Lists all recipes with nested ingredients and steps. */
export async function listRecipes(db: RecipeCatalogDb): Promise<RecipeResult<RecipeCatalogItem[]>> {
  try {
    const recipeRows = db.select().from(recipes).orderBy(desc(recipes.createdAt)).all()

    if (recipeRows.length === 0) {
      return recipeOk([])
    }

    const recipeIds = recipeRows.map(recipe => recipe.id)
    const [ingredientRows, stepRows] = [
      db.select().from(recipeIngredients).where(inArray(recipeIngredients.recipeId, recipeIds)).orderBy(recipeIngredients.position).all(),
      db.select().from(recipeSteps).where(inArray(recipeSteps.recipeId, recipeIds)).orderBy(recipeSteps.position).all(),
    ]

    const ingredientsByRecipe = groupByRecipeId(ingredientRows)
    const stepsByRecipe = groupByRecipeId(stepRows)

    return recipeOk(recipeRows.map(recipe => mapRecipe(
      recipe,
      ingredientsByRecipe.get(recipe.id) ?? [],
      stepsByRecipe.get(recipe.id) ?? [],
    )))
  }
  catch (error) {
    return recipeFail(storageError(error instanceof Error ? error.message : undefined, 'Recipes could not be loaded.'))
  }
}

/**
 * Loads a single recipe with ingredients and steps, or `not_found` if the id does not exist.
 */
export async function getRecipeById(db: RecipeCatalogDb, id: string): Promise<RecipeResult<RecipeCatalogItem>> {
  try {
    const recipeRow = db.select().from(recipes).where(eq(recipes.id, id)).get()

    if (!recipeRow) {
      return recipeFail(notFoundError('Recipe not found.'))
    }

    const ingredientRows = db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, id)).orderBy(recipeIngredients.position).all()
    const stepRows = db.select().from(recipeSteps).where(eq(recipeSteps.recipeId, id)).orderBy(recipeSteps.position).all()

    return recipeOk(mapRecipe(recipeRow, ingredientRows, stepRows))
  }
  catch (error) {
    return recipeFail(storageError(error instanceof Error ? error.message : undefined, 'Recipe could not be loaded.'))
  }
}

/**
 * Replaces all recipe fields, ingredients, and steps for the given recipe ID.
 * Returns `not_found` if the recipe does not exist.
 */
export async function updateRecipe(db: RecipeCatalogDb, id: string, payload: RecipeUpdatePayload): Promise<RecipeResult<RecipeCatalogItem>> {
  try {
    const existing = db.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, id)).get()
    if (!existing) {
      return recipeFail(notFoundError('Recipe not found.'))
    }

    const timestamp = nowIso()

    const updated = db.transaction((tx) => {
      tx.update(recipes).set({
        title: payload.title,
        description: payload.description ?? null,
        sourceUrl: payload.sourceUrl ?? null,
        sourceHost: payload.sourceHost ?? null,
        imageUrl: payload.imageUrl ?? null,
        servings: payload.servings ?? null,
        prepTimeMinutes: payload.prepTimeMinutes ?? null,
        cookTimeMinutes: payload.cookTimeMinutes ?? null,
        totalTimeMinutes: payload.totalTimeMinutes ?? null,
        difficulty: payload.difficulty ?? null,
        categories: payload.categories,
        tags: payload.tags,
        updatedAt: timestamp,
      }).where(eq(recipes.id, id)).run()

      tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id)).run()
      tx.delete(recipeSteps).where(eq(recipeSteps.recipeId, id)).run()

      const ingredientRows = payload.ingredients.map((ingredient, index) => ({
        id: randomUUID(),
        recipeId: id,
        position: index + 1,
        rawText: ingredient.rawText,
        name: ingredient.name,
        quantity: ingredient.quantity ?? null,
        unit: ingredient.unit ?? null,
        createdAt: timestamp,
      }))

      tx.insert(recipeIngredients).values(ingredientRows).run()

      const stepRows = payload.steps.map((step, index) => ({
        id: randomUUID(),
        recipeId: id,
        position: step.position ?? index + 1,
        text: step.text,
        createdAt: timestamp,
      }))

      if (stepRows.length > 0) {
        tx.insert(recipeSteps).values(stepRows).run()
      }

      return loadRecipeInTransaction(tx, id)
    })

    if (!updated) {
      return recipeFail(storageError(undefined, 'Recipe could not be updated.'))
    }

    return recipeOk(updated)
  }
  catch (error) {
    return recipeFail(storageError(error instanceof Error ? error.message : undefined, 'Recipe could not be updated.'))
  }
}

/**
 * Deletes recipes by id. Child rows cascade in the database. Returns the number of rows removed.
 */
export async function deleteRecipesByIds(db: RecipeCatalogDb, ids: string[]): Promise<RecipeResult<number>> {
  const unique = [...new Set(ids.map(id => id.trim()).filter(Boolean))]
  if (unique.length === 0) {
    return recipeOk(0)
  }

  try {
    const deleted = db.delete(recipes).where(inArray(recipes.id, unique)).returning({ id: recipes.id }).all()
    return recipeOk(deleted.length)
  }
  catch (error) {
    return recipeFail(storageError(error instanceof Error ? error.message : undefined, 'Recipes could not be deleted.'))
  }
}

/** Distinct categories and tags stored on recipes (for options endpoint). */
export async function listStoredRecipeOptions(db: RecipeCatalogDb): Promise<RecipeResult<{ categories: string[], tags: string[] }>> {
  try {
    const rows = db.select({ categories: recipes.categories, tags: recipes.tags }).from(recipes).all()
    const categories = new Set<string>()
    const tags = new Set<string>()

    for (const row of rows) {
      for (const category of row.categories) {
        categories.add(category)
      }
      for (const tag of row.tags) {
        tags.add(tag)
      }
    }

    return recipeOk({
      categories: [...categories],
      tags: [...tags],
    })
  }
  catch (error) {
    return recipeFail(storageError(error instanceof Error ? error.message : undefined, 'Could not load recipe options.'))
  }
}

function loadRecipeInTransaction(tx: RecipeCatalogDb, recipeId: string): RecipeCatalogItem | undefined {
  const recipeRow = tx.select().from(recipes).where(eq(recipes.id, recipeId)).get()
  if (!recipeRow) {
    return undefined
  }

  const ingredientRows = tx.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId)).orderBy(recipeIngredients.position).all()
  const stepRows = tx.select().from(recipeSteps).where(eq(recipeSteps.recipeId, recipeId)).orderBy(recipeSteps.position).all()
  return mapRecipe(recipeRow, ingredientRows, stepRows)
}

function groupByRecipeId<Row extends { recipeId: string }>(rows: Row[]): Map<string, Row[]> {
  const groupedRows = new Map<string, Row[]>()

  for (const row of rows) {
    groupedRows.set(row.recipeId, [...(groupedRows.get(row.recipeId) ?? []), row])
  }

  return groupedRows
}

function mapRecipe(recipe: RecipeRow, ingredients: IngredientRow[], steps: StepRow[]): RecipeCatalogItem {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description ?? undefined,
    sourceUrl: recipe.sourceUrl ?? undefined,
    sourceHost: recipe.sourceHost ?? undefined,
    imageUrl: recipe.imageUrl ?? undefined,
    servings: recipe.servings ?? undefined,
    prepTimeMinutes: recipe.prepTimeMinutes ?? undefined,
    cookTimeMinutes: recipe.cookTimeMinutes ?? undefined,
    totalTimeMinutes: recipe.totalTimeMinutes ?? undefined,
    difficulty: recipe.difficulty ?? undefined,
    categories: recipe.categories,
    tags: recipe.tags,
    ingredients: ingredients.map(ingredient => ({
      id: ingredient.id,
      position: ingredient.position,
      rawText: ingredient.rawText,
      name: ingredient.name,
      quantity: ingredient.quantity ?? undefined,
      unit: ingredient.unit ?? undefined,
    })),
    steps: steps.map(step => ({
      id: step.id,
      position: step.position,
      text: step.text,
    })),
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
  }
}

function storageError(message: string | undefined, fallback: string): RecipeFailure {
  return { kind: 'storage_error', message: message ?? fallback }
}

function notFoundError(message: string): RecipeFailure {
  return { kind: 'not_found', message }
}
