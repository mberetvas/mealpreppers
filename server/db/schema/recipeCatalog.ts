import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const recipes = sqliteTable(
  'recipes',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    sourceUrl: text('source_url'),
    sourceHost: text('source_host'),
    imageUrl: text('image_url'),
    servings: integer('servings'),
    prepTimeMinutes: integer('prep_time_minutes'),
    cookTimeMinutes: integer('cook_time_minutes'),
    totalTimeMinutes: integer('total_time_minutes'),
    difficulty: text('difficulty'),
    categories: text('categories', { mode: 'json' }).$type<string[]>().notNull(),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  table => [
    index('recipes_created_at_idx').on(table.createdAt),
  ],
)

export const recipeIngredients = sqliteTable(
  'recipe_ingredients',
  {
    id: text('id').primaryKey(),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    rawText: text('raw_text').notNull(),
    name: text('name').notNull(),
    quantity: real('quantity'),
    unit: text('unit'),
    createdAt: text('created_at').notNull(),
  },
  table => [
    index('recipe_ingredients_recipe_id_position_idx').on(table.recipeId, table.position),
  ],
)

export const recipeSteps = sqliteTable(
  'recipe_steps',
  {
    id: text('id').primaryKey(),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    text: text('text').notNull(),
    createdAt: text('created_at').notNull(),
  },
  table => [
    index('recipe_steps_recipe_id_position_idx').on(table.recipeId, table.position),
  ],
)
