import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './server/db/schema/recipeCatalog.ts',
  out: './server/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? './.data/mealprepper.db',
  },
})
