// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
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
    ...(process.env.NITRO_DESKTOP_OUTPUT_DIR
      ? { output: { dir: process.env.NITRO_DESKTOP_OUTPUT_DIR } }
      : {}),
    externals: {
      traceInclude: ['better-sqlite3', 'bindings'],
    },
  },

  css: ['~/assets/css/tailwind.css'],
})