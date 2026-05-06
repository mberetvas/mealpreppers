import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
  resolve: {
    alias: {
      'bun:test': fileURLToPath(new URL('./test/stubs/bun-test-shim.ts', import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
      await defineVitestProject({
        resolve: {
          alias: {
            'bun:test': fileURLToPath(new URL('./test/stubs/bun-test-shim.ts', import.meta.url)),
            'magic-string': fileURLToPath(new URL('./node_modules/magic-string/dist/magic-string.cjs.js', import.meta.url)),
          },
        },
        test: {
          name: 'nuxt',
          include: ['test/nuxt/*.{test,spec}.ts'],
          environment: 'nuxt',
          environmentOptions: {
            nuxt: {
              rootDir: fileURLToPath(new URL('.', import.meta.url)),
              domEnvironment: 'happy-dom',
            },
          },
        },
      }),
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
    },
  },
})
