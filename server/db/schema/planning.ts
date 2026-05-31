import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { MonthPlanV1, WeekPlanV1 } from '../../../types/planning'

/** JSON blob shape for `consolidated_shopping_list` on Saved Weekplan rows. */
export type ConsolidatedShoppingListColumn = {
  lines: unknown[]
  sourceFingerprint: string
  confirmedAt: string
} | null

export const mealWeekTemplates = sqliteTable(
  'meal_week_templates',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    body: text('body', { mode: 'json' }).$type<WeekPlanV1>().notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ownerUserId: text('owner_user_id'),
    anonSessionId: text('anon_session_id'),
    consolidatedShoppingList: text('consolidated_shopping_list', { mode: 'json' }).$type<ConsolidatedShoppingListColumn>(),
  },
  table => [
    index('meal_week_templates_updated_at_idx').on(table.updatedAt),
    index('meal_week_templates_owner_user_id_idx').on(table.ownerUserId),
    index('meal_week_templates_anon_session_id_idx').on(table.anonSessionId, table.updatedAt),
  ],
)

export const mealMonthPlans = sqliteTable(
  'meal_month_plans',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    body: text('body', { mode: 'json' }).$type<MonthPlanV1>().notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  table => [
    index('meal_month_plans_updated_at_idx').on(table.updatedAt),
  ],
)
