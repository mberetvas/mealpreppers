import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  PRIMARY_NAV_PAGE_FILES,
  getDeclaredPrimaryNavPaths,
} from '../../app/constants/primaryNavigation'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const pagesDir = join(repoRoot, 'app', 'pages')

describe('primary navigation integrity', () => {
  it('declared chrome paths match the canonical route set exactly', () => {
    const declared = new Set(getDeclaredPrimaryNavPaths())
    const mapped = new Set(Object.keys(PRIMARY_NAV_PAGE_FILES))
    expect(declared).toEqual(mapped)
  })

  for (const [routePath, pageFile] of Object.entries(PRIMARY_NAV_PAGE_FILES)) {
    it(`route ${routePath} resolves to an existing page module`, () => {
      const full = join(pagesDir, pageFile)
      expect(existsSync(full), `missing page for ${routePath}: ${full}`).toBe(true)
    })
  }

  it('each mapped page is non-empty (not a stub-only file)', () => {
    for (const [route, pageFile] of Object.entries(PRIMARY_NAV_PAGE_FILES)) {
      const full = join(pagesDir, pageFile)
      const text = readFileSync(full, 'utf8').trim()
      expect(text.length, `${route} page file is empty`).toBeGreaterThan(40)
    }
  })
})
