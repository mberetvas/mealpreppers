#!/usr/bin/env bun
/** Dev loop B: Tauri window with in-process Rust API (MEALPREPPER_SIDECAR=1). */
import { spawnSync } from 'node:child_process'

const result = spawnSync(
  'bun',
  ['x', 'tauri', 'dev', '-c', 'src-tauri/tauri.sidecar.conf.json', '--no-dev-server-wait'],
  {
    env: { ...process.env, MEALPREPPER_SIDECAR: '1' },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
)

process.exit(result.status ?? 1)
