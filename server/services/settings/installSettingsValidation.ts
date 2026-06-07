import { z } from 'zod'
import { DEFAULT_OPENROUTER_SHOPPING_LIST_MODEL } from '../../db/schema/installSettings'

const OPENROUTER_MODEL_SLUG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._:-]*$/

export const openrouterShoppingListModelSchema = z
  .string()
  .trim()
  .min(1, 'OpenRouter model id is required.')
  .max(128, 'OpenRouter model id must be at most 128 characters.')
  .regex(
    OPENROUTER_MODEL_SLUG_PATTERN,
    'OpenRouter model id must look like provider/model (letters, numbers, dots, dashes, underscores, colons).',
  )

export type InstallSettingsResponse = {
  openrouterShoppingListModel: string
}

export type InstallSettingsPatchBody = {
  openrouterShoppingListModel: string
}

export function parseInstallSettingsPatchBody(
  body: unknown,
): { ok: true, value: InstallSettingsPatchBody } | { ok: false, message: string } {
  if (body === null || typeof body !== 'object') {
    return { ok: false, message: 'Request body must be a JSON object.' }
  }

  const record = body as Record<string, unknown>
  if (!('openrouterShoppingListModel' in record)) {
    return { ok: false, message: 'openrouterShoppingListModel is required.' }
  }

  const parsed = openrouterShoppingListModelSchema.safeParse(record.openrouterShoppingListModel)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid OpenRouter model id.' }
  }

  return { ok: true, value: { openrouterShoppingListModel: parsed.data } }
}

export { DEFAULT_OPENROUTER_SHOPPING_LIST_MODEL }
