#!/usr/bin/env bun
/**
 * Builds Nuxt with the Nitro node-server preset for the Tauri sidecar.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputServer = join(repoRoot, '.output', 'server')
const migrationsSrc = join(repoRoot, 'server', 'db', 'migrations')
const migrationsDest = join(outputServer, 'db', 'migrations')

const result = spawnSync('bun', ['x', 'nuxt', 'build'], {
  cwd: repoRoot,
  env: { ...process.env, NITRO_PRESET: 'node-server' },
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

if (existsSync(migrationsSrc)) {
  mkdirSync(dirname(migrationsDest), { recursive: true })
  cpSync(migrationsSrc, migrationsDest, { recursive: true })
}

process.exit(0)
