import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecipeCreatePayload } from './recipeSchemas'

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

export async function createRecipe(client: SupabaseClient, payload: RecipeCreatePayload): Promise<RecipeCatalogItem> {
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
    throw createError({ statusCode: 500, statusMessage: recipeError?.message ?? 'Recipe could not be saved.' })
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
    throw createError({ statusCode: 500, statusMessage: ingredientsError?.message ?? 'Recipe ingredients could not be saved.' })
  }

  let steps: unknown[] = []

  if (stepRows.length > 0) {
    const { data: savedSteps, error: stepsError } = await client
      .from('recipe_steps')
      .insert(stepRows)
      .select('*')

    if (stepsError || !savedSteps) {
      await client.from('recipes').delete().eq('id', recipeRow.id)
      throw createError({ statusCode: 500, statusMessage: stepsError?.message ?? 'Recipe steps could not be saved.' })
    }

    steps = savedSteps
  }

  return mapRecipe(recipeRow, ingredients as IngredientRow[], steps as StepRow[])
}

export async function listRecipes(client: SupabaseClient): Promise<RecipeCatalogItem[]> {
  const { data: recipes, error: recipeError } = await client
    .from('recipes')
    .select('*')
    .order('created_at', { ascending: false })

  if (recipeError || !recipes) {
    throw createError({ statusCode: 500, statusMessage: recipeError?.message ?? 'Recipes could not be loaded.' })
  }

  const recipeRows = recipes as RecipeRow[]
  const recipeIds = recipeRows.map(recipe => recipe.id)

  if (recipeIds.length === 0) {
    return []
  }

  const [{ data: ingredients, error: ingredientsError }, { data: steps, error: stepsError }] = await Promise.all([
    client.from('recipe_ingredients').select('*').in('recipe_id', recipeIds).order('position', { ascending: true }),
    client.from('recipe_steps').select('*').in('recipe_id', recipeIds).order('position', { ascending: true }),
  ])

  if (ingredientsError || !ingredients) {
    throw createError({ statusCode: 500, statusMessage: ingredientsError?.message ?? 'Recipe ingredients could not be loaded.' })
  }

  if (stepsError || !steps) {
    throw createError({ statusCode: 500, statusMessage: stepsError?.message ?? 'Recipe steps could not be loaded.' })
  }

  const ingredientsByRecipe = groupByRecipeId(ingredients as IngredientRow[])
  const stepsByRecipe = groupByRecipeId(steps as StepRow[])

  return recipeRows.map(recipe => mapRecipe(
    recipe,
    ingredientsByRecipe.get(recipe.id) ?? [],
    stepsByRecipe.get(recipe.id) ?? [],
  ))
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