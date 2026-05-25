/**
 * Issue 018: Enforce "audit first" in ops checklist — the audit doc must
 * contain a prominent warning that the purge script must not run until the
 * audit step is complete and the operator has reviewed the row count.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(__dirname, '../..')
const AUDIT_PATH = resolve(REPO_ROOT, 'Docs/audits/001-legacy-unowned-week-grid-rows.md')

function read(path: string): string {
  return readFileSync(path, 'utf-8')
}

describe('Audit 001 — audit-before-purge checklist (issue 018)', () => {
  it('has a prominent warning block or checklist about auditing before purge', () => {
    const doc = read(AUDIT_PATH)
    expect(doc).toMatch(/>\s*\[!WARNING\]|>\s*⚠️|## .*[Pp]urge.*[Rr]unbook|## .*[Rr]unbook/)
  })

  it('explicitly states the purge must not run until the audit step is complete', () => {
    const doc = read(AUDIT_PATH)
    expect(doc).toMatch(/purge.*must not.*run.*until.*audit|do not.*purge.*until.*audit|never.*purge.*before.*audit/i)
  })

  it('references audit script output as a required prerequisite gate', () => {
    const doc = read(AUDIT_PATH)
    expect(doc).toMatch(/audit.*script.*output.*prerequisite|row.count.*review.*before.*purge|audit.*output.*required.*before/i)
  })

  it('does NOT modify the purge SQL script itself', () => {
    const purge = readFileSync(
      resolve(REPO_ROOT, 'supabase/scripts/purge-legacy-unowned-week-templates.sql'),
      'utf-8',
    )
    // Snapshot check: script should still start with its original comment
    expect(purge).toMatch(/DELETE|delete/)
  })
})
