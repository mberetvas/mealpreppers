import { isDesktopShell } from '../../utils/desktopRuntime'

export const OPENROUTER_SETTINGS_URL = 'https://openrouter.ai/keys'

/** Trims and rejects empty OpenRouter key input before IPC. */
export function normalizeOpenRouterKeyInput(raw: string): string | null {
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Invokes a Tauri command when running in the desktop shell; otherwise returns null. */
export async function invokeDesktopCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T | null> {
  if (!isDesktopShell()) {
    return null
  }

  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

/** Opens an https URL in the system browser when in Tauri; falls back to window.open on web. */
export async function openExternalUrl(url: string): Promise<void> {
  if (isDesktopShell()) {
    await invokeDesktopCommand('open_external_url', { url })
    return
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}
