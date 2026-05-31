import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type * as recipeCatalogSchema from './schema/recipeCatalog'

function resolveMigrationsFolder(): string {
  const candidates = [
    path.join(fileURLToPath(new URL('.', import.meta.url)), 'migrations'),
    path.join(process.cwd(), 'db', 'migrations'),
    path.join(process.cwd(), 'server', 'db', 'migrations'),
  ]

  for (const folder of candidates) {
    if (existsSync(path.join(folder, 'meta', '_journal.json'))) {
      return folder
    }
  }

  throw new Error('Drizzle migrations folder not found (expected meta/_journal.json).')
}

/** Applies pending Drizzle migrations; must complete before serving API traffic. */
export function runMigrations(db: BetterSQLite3Database<typeof recipeCatalogSchema>): void {
  migrate(db, { migrationsFolder: resolveMigrationsFolder() })
}
