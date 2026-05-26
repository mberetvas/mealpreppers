/**
 * Issue 026: ADR records shopping list human review and persistence architecture (May 2026).
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(__dirname, '../..')
const ADR_PATH = resolve(REPO_ROOT, 'docs/adr/0003-shopping-list-human-review-and-persistence.md')
const CONTEXT_PATH = resolve(REPO_ROOT, 'CONTEXT.md')

function read(path: string): string {
  return readFileSync(path, 'utf-8')
}

describe('ADR 0003 — Shopping list human review and persistence', () => {
  it('exists at docs/adr/0003-shopping-list-human-review-and-persistence.md', () => {
    expect(existsSync(ADR_PATH)).toBe(true)
  })

  it('contains required ADR sections', () => {
    const adr = read(ADR_PATH)

    expect(adr).toMatch(/## Context/i)
    expect(adr).toMatch(/## Decision/i)
    expect(adr).toMatch(/## Consequences/i)
    expect(adr).toMatch(/## Alternatives Considered/i)
  })

  it('references the PRD and notes supersession of ephemeral persistence', () => {
    const adr = read(ADR_PATH)

    expect(adr).toMatch(/shopping-list-human-review-and-persistence/)
    expect(adr).toMatch(/ADR 0002|0002-shopping-list-ai-consolidation/i)
    expect(adr).toMatch(/ephemeral/i)
    expect(adr).toMatch(/supersede|revers/i)
  })

  it('uses project vocabulary from grill session', () => {
    const adr = read(ADR_PATH)

    expect(adr).toMatch(/Shopping list polish review/i)
    expect(adr).toMatch(/Shopping list polish confirm/i)
    expect(adr).toMatch(/Shopping list source fingerprint/i)
    expect(adr).toMatch(/pending_review/)
    expect(adr).toMatch(/Shopping list polish hint/i)
    expect(adr).toMatch(/Deprecated saved consolidated shopping list/i)
    expect(adr).toMatch(/Saved consolidated shopping list/i)
    expect(adr).toMatch(/Planning Principal/i)
  })

  it('is linked from the Shopping list section in CONTEXT.md', () => {
    const context = read(CONTEXT_PATH)
    expect(context).toMatch(/docs\/adr\/0003-shopping-list-human-review-and-persistence\.md/)
  })

  it('does not contradict CONTEXT.md on Consolidated shopping list persistence', () => {
    const context = read(CONTEXT_PATH)
    const adr = read(ADR_PATH)

    // CONTEXT.md should not claim persistence IS ephemeral anymore
    expect(context).not.toMatch(/Consolidated shopping list persistence.*is ephemeral/i)
    // ADR documents persistence on Saved Weekplan
    expect(adr).toMatch(/Saved Weekplan/i)
    expect(adr).toMatch(/persist/i)
  })
})
