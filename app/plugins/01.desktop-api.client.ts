import {
  DESKTOP_TOKEN_HEADER,
  readDesktopBootstrap,
  shouldAttachDesktopToken,
} from '../../utils/desktopRuntime'

/**
 * Attaches the per-launch desktop token to localhost `$fetch` / `useFetch` calls when Tauri
 * injected `window.__MEALPREPPER_DESKTOP__` at startup.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const bootstrap = readDesktopBootstrap()
  if (!bootstrap) {
    return
  }

  const desktopFetch = $fetch.create({
    onRequest({ request, options }) {
      const requestUrl = typeof request === 'string' ? request : request.url
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
