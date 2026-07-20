#!/usr/bin/env bun
/**
 * macOS's per-user $TMPDIR (/var/folders/.../T/, ~50+ chars) plus Nitro's nested
 * vite-node socket filename overflows Darwin's 104-byte sockaddr_un limit, so
 * `nuxt dev` silently fails to bind its dev socket and every request 500s with
 * ENOENT. /tmp/ is short enough to stay under it.
 */
import { spawnSync } from 'node:child_process'

const env = { ...process.env }
if (process.platform === 'darwin') {
  env.TMPDIR = '/tmp/'
}

const result = spawnSync('bun', ['x', 'nuxt', 'dev'], {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

process.exit(result.status ?? 1)
