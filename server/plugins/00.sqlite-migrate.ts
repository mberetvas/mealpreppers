import { getDb } from '../db/sqlite'

/**
 * Ensures SQLite migrations run during Nitro startup before request handlers run.
 */
export default defineNitroPlugin(() => {
  getDb()
})
