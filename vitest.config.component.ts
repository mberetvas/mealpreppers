import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const repoRoot = fileURLToPath(new URL('.', import.meta.url))

/** Isolated Vitest project: Vue SFCs need @vitejs/plugin-vue (not applied to unit/integration). */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'bun:test': fileURLToPath(new URL('./test/stubs/bun-test-shim.ts', import.meta.url)),
      '~~': repoRoot,
      /** Match Nuxt: `~/` is the app directory (SFCs under `app/` use this in explicit imports). */
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    name: 'component',
    include: ['test/component/**/*.test.ts'],
    environment: 'happy-dom',
  },
})
