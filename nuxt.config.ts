// https://nuxt.com/docs/api/configuration/nuxt-config
const isStaticDesktopClientBuild = process.env.MEALPREPPER_STATIC_CLIENT_BUILD === '1'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  /**
   * Desktop-only product: all pages render client-side.
   * Static build (`nuxt generate`) produces a pure HTML/JS bundle served by the Tauri
   * WebView via frontendDist; the Rust Axum server handles all `/api/v1` traffic.
   */
  ssr: false,
  devtools: { enabled: true },

  runtimeConfig: {
    /** OpenRouter API key for AI shopping list polish (server-only). */
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    /** OpenRouter model for shopping list polish (default: deepseek/deepseek-v4-flash). */
    openrouterShoppingListModel: process.env.OPENROUTER_SHOPPING_LIST_MODEL || 'deepseek/deepseek-v4-flash',
    /** OpenRouter request timeout in ms (default: 60000). */
    openrouterShoppingListTimeoutMs: process.env.OPENROUTER_SHOPPING_LIST_TIMEOUT_MS || '60000',
    /** OpenRouter attribution app URL. */
    openrouterAppUrl: process.env.OPENROUTER_APP_URL || '',
    /** OpenRouter attribution app title. */
    openrouterAppTitle: process.env.OPENROUTER_APP_TITLE || 'Mealprepper',
    /** LangSmith API key — enables tracing when set (optional, dev/staging). */
    langsmithApiKey: process.env.LANGSMITH_API_KEY || '',
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/test-utils',
    '@nuxtjs/tailwindcss',
  ],

  nitro: {
    externals: {
      traceInclude: ['better-sqlite3', 'bindings'],
    },
    prerender: {
      crawlLinks: false,
      /** SPA shell only — Tauri loads `index.html`; no Nitro/SQLite during prerender. */
      routes: [],
      ...(isStaticDesktopClientBuild ? { failOnError: false } : {}),
    },
  },

  css: ['~/assets/css/tailwind.css'],
})