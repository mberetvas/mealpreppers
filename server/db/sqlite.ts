import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as recipeCatalogSchema from './schema/recipeCatalog'
import * as planningSchema from './schema/planning'
import * as installSettingsSchema from './schema/installSettings'
import { resolveDatabasePath } from './paths'
import { runMigrations } from './migrate'

const schema = { ...recipeCatalogSchema, ...planningSchema, ...installSettingsSchema }

export type AppDb = BetterSQLite3Database<typeof schema>
/** @deprecated Use `AppDb` — alias kept for recipe-catalog call sites. */
export type RecipeCatalogDb = AppDb

interface DbHandle {
  sqlite: Database.Database
  db: AppDb
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

/** Shared Drizzle DB (recipe catalog, planning, migrations on first open). */
export function getDb(): AppDb {
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
export function openTestDb(databasePath: string): AppDb {
  testHandle = openRecipeCatalogDatabase(databasePath)
  return testHandle.db
}
