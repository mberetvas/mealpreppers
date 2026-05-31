import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { isNotNull, isNull, or } from 'drizzle-orm'
import { resolveMealprepperDataDir } from '../../db/paths'
import { getDb } from '../../db/sqlite'
import { mealWeekTemplates } from '../../db/schema/planning'

const LOCAL_USER_ID_FILE = 'local-user-id'

let backfillCompleted = false

/** Reads or creates the install-scoped local planning user id. */
export function getLocalPlanningUserId(): string {
  const dataDir = resolveMealprepperDataDir()
  const filePath = path.join(dataDir, LOCAL_USER_ID_FILE)

  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf8').trim()
    if (existing.length > 0) {
      return existing
    }
  }

  const userId = randomUUID()
  writeFileSync(filePath, userId, 'utf8')
  return userId
}

/** Assigns unowned or anonymous-owned Saved Weekplans to the local install user. */
export function backfillLocalPrincipalOwnership(): void {
  if (backfillCompleted) {
    return
  }
  backfillCompleted = true

  const userId = getLocalPlanningUserId()
  const db = getDb()
  const nowIso = new Date().toISOString()

  db.update(mealWeekTemplates)
    .set({ ownerUserId: userId, anonSessionId: null, updatedAt: nowIso })
    .where(or(
      isNull(mealWeekTemplates.ownerUserId),
      isNotNull(mealWeekTemplates.anonSessionId),
    ))
    .run()
}
