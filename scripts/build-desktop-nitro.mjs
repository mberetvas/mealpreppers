#!/usr/bin/env bun
/**
 * Builds Nuxt with the Nitro node-server preset for the Tauri sidecar.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
/** Build in-place to avoid copying Nitro's junction-heavy node_modules on Windows. */
const nitroOutputDir = join(repoRoot, 'src-tauri', 'resources', 'nitro')
const outputServer = join(nitroOutputDir, 'server')
const migrationsSrc = join(repoRoot, 'server', 'db', 'migrations')
const migrationsDest = join(outputServer, 'db', 'migrations')

function removeTree(path) {
  if (!existsSync(path)) {
    return
  }
  if (process.platform === 'win32') {
    const escaped = path.replace(/'/g, "''")
    const result = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Remove-Item -LiteralPath '${escaped}' -Recurse -Force -ErrorAction Stop`,
      ],
      { stdio: 'inherit' },
    )
    if (result.status !== 0) {
      throw new Error(`Failed to remove ${path}`)
    }
    return
  }
  rmSync(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}

for (const sub of ['server', 'public']) {
  removeTree(join(nitroOutputDir, sub))
}

const result = spawnSync('bun', ['x', 'nuxt', 'build'], {
  cwd: repoRoot,
  env: {
    ...process.env,
    NITRO_PRESET: 'node-server',
    NITRO_DESKTOP_OUTPUT_DIR: nitroOutputDir,
  },
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
