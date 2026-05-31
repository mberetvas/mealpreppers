#!/usr/bin/env bun
/**
 * Copies Nitro server output and downloads a pinned Node runtime into src-tauri/resources/.
 */
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  rmSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const resourcesRoot = join(root, 'src-tauri', 'resources')
const nitroDest = join(resourcesRoot, 'nitro', 'server')

const NODE_VERSION = '22.14.0'

function platformNodePaths() {
  const platform = process.platform
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'

  if (platform === 'win32') {
    return {
      archiveName: `node-v${NODE_VERSION}-win-${arch}.zip`,
      extractDir: `node-v${NODE_VERSION}-win-${arch}`,
      nodeRelPath: join('node-v' + NODE_VERSION + '-win-' + arch, 'node.exe'),
      destDir: join(resourcesRoot, 'node', 'win-x64'),
      destBinary: join(resourcesRoot, 'node', 'win-x64', 'node.exe'),
    }
  }
  if (platform === 'darwin') {
    return {
      archiveName: `node-v${NODE_VERSION}-darwin-${arch}.tar.gz`,
      extractDir: `node-v${NODE_VERSION}-darwin-${arch}`,
      nodeRelPath: join(`node-v${NODE_VERSION}-darwin-${arch}`, 'bin', 'node'),
      destDir: join(resourcesRoot, 'node', `darwin-${arch}`),
      destBinary: join(resourcesRoot, 'node', `darwin-${arch}`, 'bin', 'node'),
    }
  }
  return {
    archiveName: `node-v${NODE_VERSION}-linux-${arch}.tar.gz`,
    extractDir: `node-v${NODE_VERSION}-linux-${arch}`,
    nodeRelPath: join(`node-v${NODE_VERSION}-linux-${arch}`, 'bin', 'node'),
    destDir: join(resourcesRoot, 'node', `linux-${arch}`),
    destBinary: join(resourcesRoot, 'node', `linux-${arch}`, 'bin', 'node'),
  }
}

async function download(url, destPath) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`)
  }
  await pipeline(response.body, createWriteStream(destPath))
}

/** Nitro is built in-place by build:desktop:nitro (see NITRO_DESKTOP_OUTPUT_DIR). */
function verifyNitroServer() {
  if (!existsSync(join(nitroDest, 'index.mjs'))) {
    throw new Error(
      'Missing src-tauri/resources/nitro/server/index.mjs. Run `bun run build:desktop:nitro` first.',
    )
  }
  console.log(`Nitro server ready at ${nitroDest}`)
}

async function ensureNodeRuntime() {
  const paths = platformNodePaths()
  if (existsSync(paths.destBinary)) {
    console.log(`Node runtime already present at ${paths.destBinary}`)
    return
  }

  const url = `https://nodejs.org/dist/v${NODE_VERSION}/${paths.archiveName}`
  const cacheDir = join(resourcesRoot, '.cache')
  mkdirSync(cacheDir, { recursive: true })
  const archivePath = join(cacheDir, paths.archiveName)

  console.log(`Downloading Node ${NODE_VERSION} from ${url}`)
  await download(url, archivePath)

  mkdirSync(paths.destDir, { recursive: true })

  if (paths.archiveName.endsWith('.zip')) {
    const unzip = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Path '${archivePath.replace(/'/g, "''")}' -DestinationPath '${cacheDir.replace(/'/g, "''")}' -Force`,
      ],
      { stdio: 'inherit' },
    )
    if (unzip.status !== 0) {
      throw new Error('Failed to extract Node zip archive')
    }
    const extractedNode = join(cacheDir, paths.extractDir, 'node.exe')
    cpSync(extractedNode, paths.destBinary)
  }
  else {
    const tar = spawnSync('tar', ['-xzf', archivePath, '-C', cacheDir], { stdio: 'inherit' })
    if (tar.status !== 0) {
      throw new Error('Failed to extract Node tar.gz archive')
    }
    mkdirSync(dirname(paths.destBinary), { recursive: true })
    cpSync(join(cacheDir, paths.nodeRelPath), paths.destBinary, { mode: 0o755 })
  }

  console.log(`Installed Node runtime at ${paths.destBinary}`)
}

async function main() {
  verifyNitroServer()
  await ensureNodeRuntime()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
