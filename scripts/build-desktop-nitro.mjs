#!/usr/bin/env bun
/**
 * Builds Nuxt with the Nitro node-server preset for the Tauri sidecar.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
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

/**
 * Removes all `node_modules/` directories nested inside the Nitro `.nitro/`
 * package cache. Nitro uses symlinks from `node_modules/pkg → .nitro/pkg@ver`
 * for deduplication, but those cached packages contain their own `node_modules/`
 * with symlinks back into `.nitro/`, forming circular chains that exceed
 * Windows MAX_PATH (260 chars) when `tauri_build` walks resources for
 * `cargo:rerun-if-changed` registration.
 *
 * After removal Node.js resolves peer deps by traversing UP from `.nitro/pkg@ver`
 * through the `.nitro/` cache directory to the outer `node_modules/`, which
 * contains all required packages as top-level symlinks.
 */
function cleanNitroPackageCache(serverNodeModules) {
  const nitroDir = join(serverNodeModules, '.nitro')
  if (!existsSync(nitroDir)) return

  console.log('Removing circular node_modules from .nitro package cache...')

  function recurse(dir) {
    let names
    try {
      names = readdirSync(dir)
    }
    catch {
      return
    }
    for (const name of names) {
      const fullPath = join(dir, name)
      let stat
      try {
        stat = lstatSync(fullPath)
      }
      catch {
        continue
      }
      if (stat.isSymbolicLink()) continue
      if (name === 'node_modules' && stat.isDirectory()) {
        removeTree(fullPath)
      }
      else if (stat.isDirectory()) {
        recurse(fullPath)
      }
    }
  }

  recurse(nitroDir)
  console.log('Done removing internal node_modules from .nitro cache.')
}

removeTree(nitroOutputDir)
mkdirSync(nitroOutputDir, { recursive: true })

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

cleanNitroPackageCache(join(outputServer, 'node_modules'))

if (existsSync(migrationsSrc)) {
  mkdirSync(dirname(migrationsDest), { recursive: true })
  cpSync(migrationsSrc, migrationsDest, { recursive: true })
}

process.exit(0)
