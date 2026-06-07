import { getDb } from '../db/sqlite'
import { isStaticDesktopClientBuild } from '../utils/staticDesktopClientBuild'
import { isStartupTimingEnabled } from '../utils/startupTiming'

/**
 * Ensures SQLite migrations run during Nitro startup before request handlers run.
 */
export default defineNitroPlugin(() => {
  if (isStaticDesktopClientBuild()) {
    return
  }

  if (!isStartupTimingEnabled()) {
    getDb()
    return
  }

  const started = performance.now()
  getDb()
  const elapsedMs = Math.round(performance.now() - started)
  console.info(`startup_timing nitro_sqlite_migrate_ms=${elapsedMs}`)
})
