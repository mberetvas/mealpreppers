#!/usr/bin/env bun
/**
 * Builds the Nuxt static client for the Tauri desktop shell.
 *
 * Runs `nuxt generate` with SSR disabled so the output is a pure client-side
 * bundle served from `frontendDist` (no Node/Nitro sidecar required).
 * Output lands in `.output/public/` which is referenced by `src-tauri/tauri.conf.json`.
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const result = spawnSync('bun', ['x', 'nuxt', 'generate'], {
  cwd: repoRoot,
  env: {
    ...process.env,
    NUXT_SSR: 'false',
    /** Skip Nitro SQLite init; packaged app uses the Rust Desktop Local API. */
    MEALPREPPER_STATIC_CLIENT_BUILD: '1',
  },
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

process.exit(result.status ?? 1)
