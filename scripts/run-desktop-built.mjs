#!/usr/bin/env bun
/**
 * Run a compiled Tauri binary (default: release). Build first with desktop:build or desktop:dev:sidecar.
 *
 * Flags:
 *   --debug    use target/debug/mealprepper(.exe)
 *   --console  set MEALPREPPER_CONSOLE=1 (AllocConsole on Windows, stderr on fatal errors)
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const debug = argv.includes('--debug')
const consoleMode = argv.includes('--console')
const targetDir = debug ? 'debug' : 'release'
const exeName = process.platform === 'win32' ? 'mealprepper.exe' : 'mealprepper'
const exePath = join(repoRoot, 'src-tauri', 'target', targetDir, exeName)

if (!existsSync(exePath)) {
  console.error(`Binary not found: ${exePath}`)
  if (debug) {
    console.error('Run: bun run build:desktop && bun run desktop:dev:sidecar (compiles debug via tauri dev)')
  }
  else {
    console.error('Run: bun run desktop:build')
  }
  process.exit(1)
}

const env = { ...process.env }

if (consoleMode) {
  env.MEALPREPPER_CONSOLE = '1'
  console.error('Mealprepper: MEALPREPPER_CONSOLE=1 (stderr + optional Windows console)')
}

const child = spawn(exePath, [], { stdio: 'inherit', env, shell: false })
child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1)
  }
  process.exit(code ?? 1)
})
