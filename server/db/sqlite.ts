import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as recipeCatalogSchema from './schema/recipeCatalog'
import { resolveDatabasePath } from './paths'
import { runMigrations } from './migrate'

const schema = { ...recipeCatalogSchema }

export type RecipeCatalogDb = BetterSQLite3Database<typeof recipeCatalogSchema>

interface DbHandle {
  sqlite: Database.Database
  db: RecipeCatalogDb
}

let handle: DbHandle | null = null
let testHandle: DbHandle | null = null

function configureSqlite(sqlite: Database.Database): void {
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('journal_mode = WAL')
}

/** Opens SQLite, applies migrations, and returns the Drizzle instance. */
export function openRecipeCatalogDatabase(databasePath: string): DbHandle {
  const sqlite = new Database(databasePath)
  configureSqlite(sqlite)
  const db = drizzle(sqlite, { schema })
  runMigrations(db)
  return { sqlite, db }
}

/** Shared Drizzle DB for recipe catalog (and migrations on first open). */
export function getDb(): RecipeCatalogDb {
  if (!handle) {
    handle = openRecipeCatalogDatabase(resolveDatabasePath())
  }
  return handle.db
}

/** Closes the singleton connection (tests). */
export function resetDbForTests(): void {
  if (handle) {
    handle.sqlite.close()
    handle = null
  }
  if (testHandle) {
    testHandle.sqlite.close()
    testHandle = null
  }
}

/** Opens an isolated DB at `databasePath` (tests). */
export function openTestDb(databasePath: string): RecipeCatalogDb {
  testHandle = openRecipeCatalogDatabase(databasePath)
  return testHandle.db
}
