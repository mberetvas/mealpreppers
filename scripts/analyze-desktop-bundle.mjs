#!/usr/bin/env bun
/**
 * Reports sizes of the packaged Nitro sidecar after `bun run build:desktop`.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const serverDir = join(repoRoot, 'src-tauri', 'resources', 'nitro', 'server')
const entry = join(serverDir, 'index.mjs')
const nodeModules = join(serverDir, 'node_modules')

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function fileSize(path) {
  if (!existsSync(path)) return 0
  return statSync(path).size
}

function dirSize(dir, { maxDepth = 32, depth = 0 } = {}) {
  if (!existsSync(dir) || depth > maxDepth) return 0
  let total = 0
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    let stat
    try {
      stat = statSync(full)
    }
    catch {
      continue
    }
    if (stat.isFile()) {
      total += stat.size
    }
    else if (stat.isDirectory()) {
      total += dirSize(full, { maxDepth, depth: depth + 1 })
    }
  }
  return total
}

function topPackages(root, limit = 15) {
  if (!existsSync(root)) return []
  const rows = []
  for (const name of readdirSync(root)) {
    if (name === '.nitro') continue
    const full = join(root, name)
    try {
      const stat = statSync(full)
      if (stat.isDirectory()) {
        rows.push({ name, bytes: dirSize(full) })
      }
    }
    catch {
      /* skip symlinks / permission errors */
    }
  }
  return rows.sort((a, b) => b.bytes - a.bytes).slice(0, limit)
}

if (!existsSync(entry)) {
  console.error(`Missing ${entry}. Run: bun run build:desktop`)
  process.exit(1)
}

console.log('Desktop Nitro sidecar bundle analysis')
console.log('─'.repeat(48))
console.log(`index.mjs:        ${formatBytes(fileSize(entry))}`)
console.log(`node_modules/:    ${formatBytes(dirSize(nodeModules))}`)
console.log(`server/ total:   ${formatBytes(dirSize(serverDir))}`)
console.log('')
console.log(`Top packages under server/node_modules:`)

for (const { name, bytes } of topPackages(nodeModules)) {
  console.log(`  ${name.padEnd(36)} ${formatBytes(bytes)}`)
}

console.log('')
console.log('Tip: MEALPREPPER_STARTUP_TIMING=1 + Docs/desktop-startup.md for cold-start baselines.')
