import { createError, defineEventHandler } from 'h3'
import { getDb } from '../../../db/sqlite'
import { getInstallSettings } from '../../../services/settings/installSettingsRepository'

export default defineEventHandler(() => {
  try {
    return getInstallSettings(getDb())
  }
  catch (err) {
    const message = err instanceof Error ? err.message : 'Install settings could not be loaded.'
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
