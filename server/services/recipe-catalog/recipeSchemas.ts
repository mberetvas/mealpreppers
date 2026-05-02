import { z } from 'zod'

const optionalPositiveIntSchema = z.number().int().positive().optional()
const optionalNonNegativeIntSchema = z.number().int().nonnegative().optional()

export const recipeIngredientInputSchema = z.object({
  rawText: z.string().trim().min(1),
  name: z.string().trim().min(1),
  quantity: z.number().nonnegative().optional(),
  unit: z.string().trim().min(1).optional(),
})

export const recipeStepInputSchema = z.object({
  position: z.number().int().positive().optional(),
  text: z.string().trim().min(1),
})

export const recipeCreatePayloadSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  sourceUrl: z.string().url().optional(),
  sourceHost: z.string().trim().optional(),
  imageUrl: z.string().url().optional(),
  servings: optionalPositiveIntSchema,
  prepTimeMinutes: optionalNonNegativeIntSchema,
  cookTimeMinutes: optionalNonNegativeIntSchema,
  totalTimeMinutes: optionalNonNegativeIntSchema,
  difficulty: z.string().trim().optional(),
  categories: z.array(z.string().trim().min(1)).default([]),
  tags: z.array(z.string().trim().min(1)).default([]),
  ingredients: z.array(recipeIngredientInputSchema).min(1),
  steps: z.array(recipeStepInputSchema).default([]),
})

export const recipePreviewRequestSchema = z.object({
  url: z.string().url(),
})

export const recipeUpdatePayloadSchema = recipeCreatePayloadSchema

export const recipeBulkDeleteRequestSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
})

export type RecipeCreatePayload = z.infer<typeof recipeCreatePayloadSchema>
export type RecipeUpdatePayload = z.infer<typeof recipeUpdatePayloadSchema>
export type RecipeIngredientInput = z.infer<typeof recipeIngredientInputSchema>
export type RecipeStepInput = z.infer<typeof recipeStepInputSchema>
export type RecipeBulkDeleteRequest = z.infer<typeof recipeBulkDeleteRequestSchema>