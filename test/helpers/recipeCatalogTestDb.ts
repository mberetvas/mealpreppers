import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach } from 'vitest'
import type { RecipeCatalogDb } from '../../server/db/sqlite'
import { openTestDb, resetDbForTests } from '../../server/db/sqlite'

export interface RecipeCatalogTestContext {
  db: RecipeCatalogDb
  databasePath: string
  dataDir: string
}

/** Creates an isolated file-backed SQLite database for recipe catalog tests. */
export function useRecipeCatalogTestDb(): RecipeCatalogTestContext {
  const ctx = {} as RecipeCatalogTestContext

  beforeEach(() => {
    resetDbForTests()
    const dataDir = mkdtempSync(path.join(tmpdir(), 'mealprepper-test-'))
    ctx.dataDir = dataDir
    ctx.databasePath = path.join(dataDir, 'mealprepper.db')
    process.env.MEALPREPPER_DATA_DIR = dataDir
    process.env.DATABASE_PATH = ctx.databasePath
    ctx.db = openTestDb(ctx.databasePath)
  })

  afterEach(() => {
    resetDbForTests()
    delete process.env.MEALPREPPER_DATA_DIR
    delete process.env.DATABASE_PATH
    if (ctx.dataDir) {
      rmSync(ctx.dataDir, { recursive: true, force: true })
    }
  })

  return ctx
}
