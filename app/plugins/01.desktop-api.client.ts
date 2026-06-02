import {
  DESKTOP_TOKEN_HEADER,
  readDesktopBootstrap,
  shouldAttachDesktopToken,
} from '../../utils/desktopRuntime'

/**
 * Points `$fetch` / `useFetch` at the in-process Desktop Local API and attaches the per-launch
 * token when Tauri injected `window.__MEALPREPPER_DESKTOP__` at startup.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const bootstrap = readDesktopBootstrap()
  if (!bootstrap) {
    return
  }

  const desktopFetch = $fetch.create({
    onRequest({ request, options }) {
      const requestUrl = typeof request === 'string' ? request : request.url
      // Only loopback API paths — do not set a global baseURL or Nuxt payload/asset
      // fetches are sent to the Rust server and the app never mounts (white screen).
      if (requestUrl.startsWith('/api/')) {
        options.baseURL = bootstrap.apiBase
      }

      if (!shouldAttachDesktopToken(requestUrl, bootstrap)) {
        return
      }

      const headers = new Headers(options.headers as HeadersInit | undefined)
      headers.set(DESKTOP_TOKEN_HEADER, bootstrap.token)
      options.headers = headers
    },
  })

  globalThis.$fetch = desktopFetch
  nuxtApp.$fetch = desktopFetch
  nuxtApp.provide('fetch', desktopFetch)
})
