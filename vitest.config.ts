import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const repoRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      'bun:test': fileURLToPath(new URL('./test/stubs/bun-test-shim.ts', import.meta.url)),
      '~~': repoRoot,
    },
  },
  test: {
    projects: [
      {
        resolve: {
          alias: {
            'bun:test': fileURLToPath(new URL('./test/stubs/bun-test-shim.ts', import.meta.url)),
            '~~': repoRoot,
          },
        },
        test: {
          name: 'unit',
          include: ['test/unit/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
      {
        resolve: {
          alias: {
            'bun:test': fileURLToPath(new URL('./test/stubs/bun-test-shim.ts', import.meta.url)),
            '~~': repoRoot,
          },
        },
        test: {
          name: 'integration',
          include: ['test/integration/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
      'vitest.config.component.ts',
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
    },
  },
})
