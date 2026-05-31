/**
 * Runtime bootstrap injected by Tauri before the WebView loads (not baked into static assets).
 */
export interface MealprepperDesktopBootstrap {
  apiBase: string
  token: string
}

declare global {
  interface Window {
    __MEALPREPPER_DESKTOP__?: MealprepperDesktopBootstrap
  }
}

/** Desktop bootstrap from Tauri initialization script, when present. */
export function readDesktopBootstrap(): MealprepperDesktopBootstrap | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }
  const raw = window.__MEALPREPPER_DESKTOP__
  if (!raw?.token?.trim() || !raw.apiBase?.trim()) {
    return undefined
  }
  return {
    apiBase: raw.apiBase.replace(/\/$/, ''),
    token: raw.token.trim(),
  }
}

/** Whether a request URL targets the local Nitro API and should carry the desktop token. */
export function shouldAttachDesktopToken(requestUrl: string, bootstrap?: MealprepperDesktopBootstrap): boolean {
  if (!bootstrap) {
    return false
  }

  if (requestUrl.startsWith('/api/')) {
    return true
  }

  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1'
    const resolved = new URL(requestUrl, base)
    const apiOrigin = new URL(bootstrap.apiBase).origin
    return resolved.origin === apiOrigin
  }
  catch {
    return false
  }
}

/** Header name for loopback API authentication. */
export const DESKTOP_TOKEN_HEADER = 'x-desktop-token'
