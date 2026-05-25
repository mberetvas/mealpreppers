/**
 * Issue 006: ADR records Saved Weekplans single-persistence architecture (May 2026).
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(__dirname, '../..')
const ADR_PATH = resolve(REPO_ROOT, 'docs/adr/0001-saved-weekplans-single-persistence.md')
const CONTEXT_PATH = resolve(REPO_ROOT, 'CONTEXT.md')

function read(path: string): string {
  return readFileSync(path, 'utf-8')
}

describe('ADR 0001 — Saved Weekplans single persistence', () => {
  it('exists at docs/adr/0001-saved-weekplans-single-persistence.md', () => {
    expect(existsSync(ADR_PATH)).toBe(true)
  })

  it('states the agreed architecture decisions in project vocabulary', () => {
    const adr = read(ADR_PATH)

    expect(adr).toMatch(/Saved Weekplan/i)
    expect(adr).toMatch(/only product concept.*persisted week grid/i)
    expect(adr).toMatch(/Planning Principal/i)
    expect(adr).toMatch(/principal-scoped/i)
    expect(adr).toMatch(/\/api\/v1\/planning\/week-templates/i)
    expect(adr).toMatch(/removed|retired/i)
    expect(adr).toMatch(/legacy_unowned/i)
    expect(adr).toMatch(/audit|migration/i)
    expect(adr).toMatch(/planningRepository/i)
    expect(adr).toMatch(/month plan/i)
    expect(adr).toMatch(/recipe-id|recipe id/i)
  })

  it('is linked from the Planning section in CONTEXT.md', () => {
    const context = read(CONTEXT_PATH)
    expect(context).toMatch(/docs\/adr\/0001-saved-weekplans-single-persistence\.md/)
  })

  it('does not contradict CONTEXT.md on Saved Weekplans HTTP surface', () => {
    const context = read(CONTEXT_PATH)
    const adr = read(ADR_PATH)

    expect(context).toMatch(/\/api\/v1\/saved-weekplans/)
    expect(context).toMatch(/week-templates.*retired/i)
    expect(adr).toMatch(/\/api\/v1\/saved-weekplans/)
    expect(adr).not.toMatch(/week-templates.*(supported|active|available)/i)
  })
})
