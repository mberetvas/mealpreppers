import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { DEFAULT_OPENROUTER_SHOPPING_LIST_MODEL, installSettings } from '../../server/db/schema/installSettings'
import { getInstallSettings, updateShoppingListModel } from '../../server/services/settings/installSettingsRepository'
import { useAppTestDb } from '../helpers/recipeCatalogTestDb'

const ctx = useAppTestDb()

describe('installSettingsRepository', () => {
  it('returns the canonical default model on a fresh database', () => {
    const settings = getInstallSettings(ctx.db)
    expect(settings.openrouterShoppingListModel).toBe(DEFAULT_OPENROUTER_SHOPPING_LIST_MODEL)
  })

  it('updates the singleton row and reads it back', () => {
    const updated = updateShoppingListModel(ctx.db, 'anthropic/claude-3.5-sonnet')
    expect(updated.openrouterShoppingListModel).toBe('anthropic/claude-3.5-sonnet')

    const row = ctx.db
      .select()
      .from(installSettings)
      .where(eq(installSettings.id, 1))
      .get()
    expect(row?.openrouterShoppingListModel).toBe('anthropic/claude-3.5-sonnet')

    const reread = getInstallSettings(ctx.db)
    expect(reread.openrouterShoppingListModel).toBe('anthropic/claude-3.5-sonnet')
  })
})
