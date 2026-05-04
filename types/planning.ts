import { z } from 'zod'

const recipeIdSlotSchema = z.object({
  recipeId: z.union([z.string().uuid(), z.null()]),
})

const dayMealsSchema = z.object({
  breakfast: recipeIdSlotSchema,
  lunch: recipeIdSlotSchema,
  dinner: recipeIdSlotSchema,
})

const weekDaysSchema = z.object({
  '1': dayMealsSchema,
  '2': dayMealsSchema,
  '3': dayMealsSchema,
  '4': dayMealsSchema,
  '5': dayMealsSchema,
  '6': dayMealsSchema,
  '7': dayMealsSchema,
})

/** Stored JSON body for a week template row (`meal_week_templates.body`). */
export const weekPlanV1Schema = z.object({
  version: z.literal('week_v1'),
  days: weekDaysSchema,
})

export type WeekPlanV1 = z.infer<typeof weekPlanV1Schema>

const weekOrNullSchema = weekPlanV1Schema.nullable()

/** Stored JSON body for a month plan row (`meal_month_plans.body`). */
export const monthPlanV1Schema = z.object({
  version: z.literal('month_v1'),
  weeks: z.tuple([weekOrNullSchema, weekOrNullSchema, weekOrNullSchema, weekOrNullSchema]),
})

export type MonthPlanV1 = z.infer<typeof monthPlanV1Schema>

export const weekTemplateCreateSchema = z.object({
  name: z.string().trim().min(1),
  body: weekPlanV1Schema,
})

export const weekTemplatePatchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  body: weekPlanV1Schema.optional(),
}).refine(data => data.name !== undefined || data.body !== undefined, {
  message: 'Provide at least one of name or body.',
})

export const monthPlanCreateSchema = z.object({
  name: z.union([z.string().trim().min(1), z.null()]).optional(),
  body: monthPlanV1Schema,
})

export const monthPlanPatchSchema = z.object({
  name: z.union([z.string().trim().min(1), z.null()]).optional(),
  body: monthPlanV1Schema.optional(),
}).refine(data => data.name !== undefined || data.body !== undefined, {
  message: 'Provide at least one of name or body.',
})

export type WeekTemplateCreateInput = z.infer<typeof weekTemplateCreateSchema>
export type WeekTemplatePatchInput = z.infer<typeof weekTemplatePatchSchema>
export type MonthPlanCreateInput = z.infer<typeof monthPlanCreateSchema>
export type MonthPlanPatchInput = z.infer<typeof monthPlanPatchSchema>
