import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecipeCatalogItem } from '../../../types/recipe-catalog-item'
import type { RecipeCreatePayload, RecipeUpdatePayload } from './recipeSchemas'
import type { RecipeFailure, RecipeResult } from './recipeResult'
import { recipeFail, recipeOk } from './recipeResult'

interface RecipeRow {
  id: string
  title: string
  description: string | null
  source_url: string | null
  source_host: string | null
  image_url: string | null
  servings: number | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  total_time_minutes: number | null
  difficulty: string | null
  categories: string[]
  tags: string[]
  created_at: string
  updated_at: string
}

interface IngredientRow {
  id: string
  recipe_id: string
  position: number
  raw_text: string
  name: string
  quantity: number | null
  unit: string | null
}

interface StepRow {
  id: string
  recipe_id: string
  position: number
  text: string
}

export type { RecipeCatalogItem }

/** Inserts a recipe with ingredients and optional steps. */
export async function createRecipe(client: SupabaseClient, payload: RecipeCreatePayload): Promise<RecipeResult<RecipeCatalogItem>> {
  const recipeInsert = {
    title: payload.title,
    description: payload.description,
    source_url: payload.sourceUrl,
    source_host: payload.sourceHost,
    image_url: payload.imageUrl,
    servings: payload.servings,
    prep_time_minutes: payload.prepTimeMinutes,
    cook_time_minutes: payload.cookTimeMinutes,
    total_time_minutes: payload.totalTimeMinutes,
    difficulty: payload.difficulty,
    categories: payload.categories,
    tags: payload.tags,
  }

  const { data: recipe, error: recipeError } = await client
    .from('recipes')
    .insert(recipeInsert)
    .select('*')
    .single()

  if (recipeError || !recipe) {
    return recipeFail(storageError(recipeError?.message, 'Recipe could not be saved.'))
  }

  const recipeRow = recipe as RecipeRow
  const ingredientRows = payload.ingredients.map((ingredient, index) => ({
    recipe_id: recipeRow.id,
    position: index + 1,
    raw_text: ingredient.rawText,
    name: ingredient.name,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
  }))
  const stepRows = payload.steps.map((step, index) => ({
    recipe_id: recipeRow.id,
    position: step.position ?? index + 1,
    text: step.text,
  }))

  const { data: ingredients, error: ingredientsError } = await client
    .from('recipe_ingredients')
    .insert(ingredientRows)
    .select('*')

  if (ingredientsError || !ingredients) {
    await client.from('recipes').delete().eq('id', recipeRow.id)
    return recipeFail(storageError(ingredientsError?.message, 'Recipe ingredients could not be saved.'))
  }

  let steps: unknown[] = []

  if (stepRows.length > 0) {
    const { data: savedSteps, error: stepsError } = await client
      .from('recipe_steps')
      .insert(stepRows)
      .select('*')

    if (stepsError || !savedSteps) {
      await client.from('recipes').delete().eq('id', recipeRow.id)
      return recipeFail(storageError(stepsError?.message, 'Recipe steps could not be saved.'))
    }

    steps = savedSteps
  }

  return recipeOk(mapRecipe(recipeRow, ingredients as IngredientRow[], steps as StepRow[]))
}

/** Lists all recipes with nested ingredients and steps. */
export async function listRecipes(client: SupabaseClient): Promise<RecipeResult<RecipeCatalogItem[]>> {
  const { data: recipes, error: recipeError } = await client
    .from('recipes')
    .select('*')
    .order('created_at', { ascending: false })

  if (recipeError || !recipes) {
    return recipeFail(storageError(recipeError?.message, 'Recipes could not be loaded.'))
  }

  const recipeRows = recipes as RecipeRow[]
  const recipeIds = recipeRows.map(recipe => recipe.id)

  if (recipeIds.length === 0) {
    return recipeOk([])
  }

  const [{ data: ingredients, error: ingredientsError }, { data: steps, error: stepsError }] = await Promise.all([
    client.from('recipe_ingredients').select('*').in('recipe_id', recipeIds).order('position', { ascending: true }),
    client.from('recipe_steps').select('*').in('recipe_id', recipeIds).order('position', { ascending: true }),
  ])

  if (ingredientsError || !ingredients) {
    return recipeFail(storageError(ingredientsError?.message, 'Recipe ingredients could not be loaded.'))
  }

  if (stepsError || !steps) {
    return recipeFail(storageError(stepsError?.message, 'Recipe steps could not be loaded.'))
  }

  const ingredientsByRecipe = groupByRecipeId(ingredients as IngredientRow[])
  const stepsByRecipe = groupByRecipeId(steps as StepRow[])

  return recipeOk(recipeRows.map(recipe => mapRecipe(
    recipe,
    ingredientsByRecipe.get(recipe.id) ?? [],
    stepsByRecipe.get(recipe.id) ?? [],
  )))
}

/**
 * Loads a single recipe with ingredients and steps, or `not_found` if the id does not exist.
 */
export async function getRecipeById(client: SupabaseClient, id: string): Promise<RecipeResult<RecipeCatalogItem>> {
  const { data: recipe, error: recipeError } = await client
    .from('recipes')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (recipeError) {
    return recipeFail(storageError(recipeError.message, 'Recipe could not be loaded.'))
  }

  if (!recipe) {
    return recipeFail(notFoundError('Recipe not found.'))
  }

  const recipeRow = recipe as RecipeRow
  const [ingredientsRes, stepsRes] = await Promise.all([
    client
      .from('recipe_ingredients')
      .select('*')
      .eq('recipe_id', id)
      .order('position', { ascending: true }),
    client
      .from('recipe_steps')
      .select('*')
      .eq('recipe_id', id)
      .order('position', { ascending: true }),
  ])

  if (ingredientsRes.error || !ingredientsRes.data) {
    return recipeFail(storageError(ingredientsRes.error?.message, 'Recipe ingredients could not be loaded.'))
  }

  if (stepsRes.error) {
    return recipeFail(storageError(stepsRes.error.message, 'Recipe steps could not be loaded.'))
  }

  return recipeOk(mapRecipe(
    recipeRow,
    ingredientsRes.data as IngredientRow[],
    (stepsRes.data ?? []) as StepRow[],
  ))
}

/**
 * Replaces all recipe fields, ingredients, and steps for the given recipe ID.
 * Returns `not_found` if the recipe does not exist.
 */
export async function updateRecipe(client: SupabaseClient, id: string, payload: RecipeUpdatePayload): Promise<RecipeResult<RecipeCatalogItem>> {
  const recipeUpdate = {
    title: payload.title,
    description: payload.description ?? null,
    source_url: payload.sourceUrl ?? null,
    source_host: payload.sourceHost ?? null,
    image_url: payload.imageUrl ?? null,
    servings: payload.servings ?? null,
    prep_time_minutes: payload.prepTimeMinutes ?? null,
    cook_time_minutes: payload.cookTimeMinutes ?? null,
    total_time_minutes: payload.totalTimeMinutes ?? null,
    difficulty: payload.difficulty ?? null,
    categories: payload.categories,
    tags: payload.tags,
  }

  const { data: recipe, error: recipeError } = await client
    .from('recipes')
    .update(recipeUpdate)
    .eq('id', id)
    .select('*')
    .single()

  if (recipeError || !recipe) {
    if (recipeError?.code === 'PGRST116') {
      return recipeFail(notFoundError('Recipe not found.'))
    }
    return recipeFail(storageError(recipeError?.message, 'Recipe could not be updated.'))
  }

  const recipeRow = recipe as RecipeRow

  await client.from('recipe_ingredients').delete().eq('recipe_id', id)

  const ingredientRows = payload.ingredients.map((ingredient, index) => ({
    recipe_id: id,
    position: index + 1,
    raw_text: ingredient.rawText,
    name: ingredient.name,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
  }))

  const { data: ingredients, error: ingredientsError } = await client
    .from('recipe_ingredients')
    .insert(ingredientRows)
    .select('*')

  if (ingredientsError || !ingredients) {
    return recipeFail(storageError(ingredientsError?.message, 'Recipe ingredients could not be saved.'))
  }

  await client.from('recipe_steps').delete().eq('recipe_id', id)

  let steps: unknown[] = []
  const stepRows = payload.steps.map((step, index) => ({
    recipe_id: id,
    position: step.position ?? index + 1,
    text: step.text,
  }))

  if (stepRows.length > 0) {
    const { data: savedSteps, error: stepsError } = await client
      .from('recipe_steps')
      .insert(stepRows)
      .select('*')

    if (stepsError || !savedSteps) {
      return recipeFail(storageError(stepsError?.message, 'Recipe steps could not be saved.'))
    }

    steps = savedSteps
  }

  return recipeOk(mapRecipe(recipeRow, ingredients as IngredientRow[], steps as StepRow[]))
}

/**
 * Deletes recipes by id. Child rows cascade in the database. Returns the number of rows removed.
 */
export async function deleteRecipesByIds(client: SupabaseClient, ids: string[]): Promise<RecipeResult<number>> {
  const unique = [...new Set(ids.map(id => id.trim()).filter(Boolean))]
  if (unique.length === 0) {
    return recipeOk(0)
  }

  const { data, error } = await client
    .from('recipes')
    .delete()
    .in('id', unique)
    .select('id')

  if (error) {
    return recipeFail(storageError(error.message, 'Recipes could not be deleted.'))
  }

  return recipeOk(data?.length ?? 0)
}

function groupByRecipeId<Row extends { recipe_id: string }>(rows: Row[]): Map<string, Row[]> {
  const groupedRows = new Map<string, Row[]>()

  for (const row of rows) {
    groupedRows.set(row.recipe_id, [...(groupedRows.get(row.recipe_id) ?? []), row])
  }

  return groupedRows
}

function mapRecipe(recipe: RecipeRow, ingredients: IngredientRow[], steps: StepRow[]): RecipeCatalogItem {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description ?? undefined,
    sourceUrl: recipe.source_url ?? undefined,
    sourceHost: recipe.source_host ?? undefined,
    imageUrl: recipe.image_url ?? undefined,
    servings: recipe.servings ?? undefined,
    prepTimeMinutes: recipe.prep_time_minutes ?? undefined,
    cookTimeMinutes: recipe.cook_time_minutes ?? undefined,
    totalTimeMinutes: recipe.total_time_minutes ?? undefined,
    difficulty: recipe.difficulty ?? undefined,
    categories: recipe.categories,
    tags: recipe.tags,
    ingredients: ingredients.map(ingredient => ({
      id: ingredient.id,
      position: ingredient.position,
      rawText: ingredient.raw_text,
      name: ingredient.name,
      quantity: ingredient.quantity ?? undefined,
      unit: ingredient.unit ?? undefined,
    })),
    steps: steps.map(step => ({
      id: step.id,
      position: step.position,
      text: step.text,
    })),
    createdAt: recipe.created_at,
    updatedAt: recipe.updated_at,
  }
}

function storageError(message: string | undefined, fallback: string): RecipeFailure {
  return { kind: 'storage_error', message: message ?? fallback }
}

function notFoundError(message: string): RecipeFailure {
  return { kind: 'not_found', message }
}
