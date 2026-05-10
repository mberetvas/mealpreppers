// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  runtimeConfig: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    /** Bearer secret for POST /api/v1/internal/saved-weekplans/purge-idle-anonymous (cron / batch). */
    savedWeekplansIdlePurgeSecret: process.env.SAVED_WEEKPLANS_IDLE_PURGE_SECRET,
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/test-utils',
    '@nuxtjs/tailwindcss',
  ],

  css: ['~/assets/css/tailwind.css'],

  app: {
    head: {
      link: [
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&family=Plus+Jakarta+Sans:wght@200..800&display=swap',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap',
        },
      ],
    },
  },
})