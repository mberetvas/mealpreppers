import { mkdirSync } from 'node:fs'
import path from 'node:path'

const DEFAULT_DATA_DIR = path.join(process.cwd(), '.data')

/** Application data root (SQLite file and `recipe-images/`). */
export function resolveMealprepperDataDir(): string {
  const configured = process.env.MEALPREPPER_DATA_DIR?.trim()
  const dataDir = configured && configured.length > 0 ? configured : DEFAULT_DATA_DIR
  mkdirSync(dataDir, { recursive: true })
  return dataDir
}

/** SQLite database file path. */
export function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_PATH?.trim()
  if (configured && configured.length > 0) {
    mkdirSync(path.dirname(configured), { recursive: true })
    return configured
  }
  const dataDir = resolveMealprepperDataDir()
  return path.join(dataDir, 'mealprepper.db')
}

/** Directory for uploaded recipe image files. */
export function resolveRecipeImagesDir(): string {
  const configured = process.env.RECIPE_IMAGES_DIR?.trim()
  if (configured && configured.length > 0) {
    mkdirSync(configured, { recursive: true })
    return configured
  }
  const dir = path.join(resolveMealprepperDataDir(), 'recipe-images')
  mkdirSync(dir, { recursive: true })
  return dir
}
