/**
 * Issue 013: Audit doc reflects current state after ADR 0001 route removal.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(__dirname, '../..')
const AUDIT_PATH = resolve(REPO_ROOT, 'Docs/audits/001-legacy-unowned-week-grid-rows.md')

function read(path: string): string {
  return readFileSync(path, 'utf-8')
}

describe('Audit 001 — legacy unowned week grid rows', () => {
  it('exists at Docs/audits/001-legacy-unowned-week-grid-rows.md', () => {
    expect(existsSync(AUDIT_PATH)).toBe(true)
  })

  it('does NOT state legacy_unowned rows are visible via deprecated week-templates routes', () => {
    const doc = read(AUDIT_PATH)
    expect(doc).not.toMatch(/visible.*via.*deprecated.*week-templates/i)
    expect(doc).not.toMatch(/visible only via deprecated/i)
  })

  it('states legacy_unowned rows are hidden from Saved Weekplans API (404) since routes were removed', () => {
    const doc = read(AUDIT_PATH)
    expect(doc).toMatch(/hidden.*Saved Weekplans.*API/i)
    expect(doc).toMatch(/404/)
    expect(doc).toMatch(/routes.*removed|removed.*routes/i)
  })

  it('identifies supabase/scripts/ SQL scripts as the only recovery path', () => {
    const doc = read(AUDIT_PATH)
    expect(doc).toMatch(/supabase\/scripts\//)
    expect(doc).toMatch(/only.*recovery|recovery.*only/i)
  })

  it('cross-references ADR 0001', () => {
    const doc = read(AUDIT_PATH)
    expect(doc).toMatch(/ADR 0001/)
    expect(doc).toMatch(/0001-saved-weekplans-single-persistence/)
  })
})
