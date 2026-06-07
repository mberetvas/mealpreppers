import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const DEFAULT_OPENROUTER_SHOPPING_LIST_MODEL = 'deepseek/deepseek-v4-flash'

export const installSettings = sqliteTable('install_settings', {
  id: integer('id').primaryKey(),
  openrouterShoppingListModel: text('openrouter_shopping_list_model')
    .notNull()
    .default(DEFAULT_OPENROUTER_SHOPPING_LIST_MODEL),
})
