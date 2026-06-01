import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type * as recipeCatalogSchema from './schema/recipeCatalog'
import type * as planningSchema from './schema/planning'

type AppSchema = typeof recipeCatalogSchema & typeof planningSchema

function resolveMigrationsFolder(): string {
  const candidates = [
    path.join(process.cwd(), 'db', 'migrations'),
    path.join(process.cwd(), 'server', 'db', 'migrations'),
  ]

  try {
    candidates.push(
      path.join(fileURLToPath(new URL('.', import.meta.url)), 'migrations'),
    )
  }
  catch {
    // import.meta.url may not be resolvable in all bundled contexts; cwd paths above still apply.
  }

  for (const folder of candidates) {
    if (existsSync(path.join(folder, 'meta', '_journal.json'))) {
      return folder
    }
  }

  throw new Error('Drizzle migrations folder not found (expected meta/_journal.json).')
}

/** Applies pending Drizzle migrations; must complete before serving API traffic. */
export function runMigrations(db: BetterSQLite3Database<AppSchema>): void {
  migrate(db, { migrationsFolder: resolveMigrationsFolder() })
}
