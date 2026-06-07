import { createError, defineEventHandler, readBody } from 'h3'
import { getDb } from '../../../db/sqlite'
import { updateShoppingListModel } from '../../../services/settings/installSettingsRepository'
import { parseInstallSettingsPatchBody } from '../../../services/settings/installSettingsValidation'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = parseInstallSettingsPatchBody(body)
  if (!parsed.ok) {
    throw createError({ statusCode: 400, statusMessage: parsed.message })
  }

  try {
    return updateShoppingListModel(getDb(), parsed.value.openrouterShoppingListModel)
  }
  catch (err) {
    const message = err instanceof Error ? err.message : 'Install settings could not be saved.'
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
