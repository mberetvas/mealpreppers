import { eq } from 'drizzle-orm'
import type { AppDb } from '../../db/sqlite'
import {
  DEFAULT_OPENROUTER_SHOPPING_LIST_MODEL,
  installSettings,
} from '../../db/schema/installSettings'
import type { InstallSettingsResponse } from './installSettingsValidation'

const SINGLETON_ID = 1

function rowToResponse(
  row: { openrouterShoppingListModel: string } | undefined,
): InstallSettingsResponse {
  return {
    openrouterShoppingListModel:
      row?.openrouterShoppingListModel ?? DEFAULT_OPENROUTER_SHOPPING_LIST_MODEL,
  }
}

/** Reads install-scoped settings (singleton row `id = 1`). */
export function getInstallSettings(db: AppDb): InstallSettingsResponse {
  const row = db
    .select()
    .from(installSettings)
    .where(eq(installSettings.id, SINGLETON_ID))
    .get()

  return rowToResponse(row)
}

/** Updates the OpenRouter shopping-list polish model on the singleton row. */
export function updateShoppingListModel(db: AppDb, model: string): InstallSettingsResponse {
  db.insert(installSettings)
    .values({
      id: SINGLETON_ID,
      openrouterShoppingListModel: model,
    })
    .onConflictDoUpdate({
      target: installSettings.id,
      set: { openrouterShoppingListModel: model },
    })
    .run()

  return getInstallSettings(db)
}
