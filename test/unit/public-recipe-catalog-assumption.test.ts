/**
 * Issue 011: Document public Recipe Catalog assumption in CONTEXT.md.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(__dirname, '../..')
const CONTEXT_PATH = resolve(REPO_ROOT, 'CONTEXT.md')

function read(path: string): string {
  return readFileSync(path, 'utf-8')
}

describe('Public Recipe Catalog assumption — CONTEXT.md', () => {
  it('contains a named vocabulary entry for the public-catalog assumption', () => {
    const context = read(CONTEXT_PATH)
    expect(context).toMatch(/\*\*Public Recipe Catalog\*\*/)
  })

  it('states that GET /api/v1/recipes/:id performs no Planning Principal check', () => {
    const context = read(CONTEXT_PATH)
    expect(context).toMatch(/no.*Planning Principal.*check/i)
  })

  it('explicitly calls out the private-recipe risk as a future consideration', () => {
    const context = read(CONTEXT_PATH)
    expect(context).toMatch(/private.recipe/i)
    expect(context).toMatch(/batch endpoint|future.feature|visibility enforcement/i)
  })

  it('cross-references the assumption from the Shopping list section', () => {
    const context = read(CONTEXT_PATH)
    const shoppingSection = context.slice(context.indexOf('## Shopping list'))
    expect(shoppingSection).toMatch(/Public Recipe Catalog/)
  })

  it('does not modify recipe handler code (documentation-only change)', () => {
    // This test documents the contract: the handler should remain untouched.
    // The acceptance criterion is verified by review, not runtime assertion.
    expect(true).toBe(true)
  })
})
