import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

describe('desktop build configuration', () => {
  it('build:desktop script does not invoke Nitro build steps', () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
    const script: string = pkg.scripts['build:desktop'] ?? ''
    expect(script).not.toContain('build:desktop:nitro')
    expect(script).not.toContain('build:desktop:resources')
  })

  it('package.json has no build:desktop:nitro or build:desktop:resources scripts', () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
    expect(pkg.scripts).not.toHaveProperty('build:desktop:nitro')
    expect(pkg.scripts).not.toHaveProperty('build:desktop:resources')
  })

  it('tauri bundle resources do not include Nitro or Node sidecar directories', () => {
    const conf = JSON.parse(
      readFileSync(join(repoRoot, 'src-tauri', 'tauri.conf.json'), 'utf8'),
    )
    const resources: Record<string, string> = conf.bundle?.resources ?? {}
    const keys = Object.keys(resources)
    expect(keys).not.toContain('resources/nitro/')
    expect(keys).not.toContain('resources/node/')
  })

  it('tauri frontendDist does not reference the Nitro output directory', () => {
    const conf = JSON.parse(
      readFileSync(join(repoRoot, 'src-tauri', 'tauri.conf.json'), 'utf8'),
    )
    const frontendDist: string = conf.build?.frontendDist ?? ''
    expect(frontendDist).not.toContain('nitro')
  })
})
