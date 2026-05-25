import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { checkEnvironmentGuard } from '../../scripts/env-guard'

const ROOT = resolve(__dirname, '../..')

describe('audit script MEALPREPPERS_ENV guard', () => {
  describe('checkEnvironmentGuard', () => {
    it('rejects when MEALPREPPERS_ENV is undefined', () => {
      const result = checkEnvironmentGuard(undefined)
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('unset')
        expect(result.message).toMatch(/MEALPREPPERS_ENV.*not set/i)
      }
    })

    it('rejects when MEALPREPPERS_ENV is empty string', () => {
      const result = checkEnvironmentGuard('')
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('unset')
      }
    })

    it('rejects non-local values and identifies the environment in the message', () => {
      const result = checkEnvironmentGuard('production')
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('non-local')
        expect(result.environment).toBe('production')
        expect(result.message).toContain('production')
        expect(result.message).toMatch(/non-local/i)
      }
    })

    it('rejects staging environment', () => {
      const result = checkEnvironmentGuard('staging')
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('non-local')
        expect(result.environment).toBe('staging')
        expect(result.message).toContain('staging')
      }
    })

    it('allows local environment', () => {
      const result = checkEnvironmentGuard('local')
      expect(result.allowed).toBe(true)
      if (result.allowed) {
        expect(result.environment).toBe('local')
      }
    })
  })

  describe('audit script integration', () => {
    const script = readFileSync(
      resolve(ROOT, 'scripts/audit-legacy-unowned-week-templates.ts'),
      'utf-8',
    )

    it('imports and calls checkEnvironmentGuard', () => {
      expect(script).toMatch(/checkEnvironmentGuard/)
    })

    it('exits when guard rejects (process.exit)', () => {
      expect(script).toMatch(/process\.exit/)
    })

    it('does not default MEALPREPPERS_ENV to local (no fallback)', () => {
      expect(script).not.toMatch(/process\.env\.MEALPREPPERS_ENV\s*\?\?\s*['"]local['"]/)
    })
  })

  describe('audit runbook prerequisite', () => {
    const doc = readFileSync(
      resolve(ROOT, 'Docs/audits/001-legacy-unowned-week-grid-rows.md'),
      'utf-8',
    )

    it('mentions MEALPREPPERS_ENV=local as a prerequisite', () => {
      expect(doc).toMatch(/MEALPREPPERS_ENV=local/)
      expect(doc).toMatch(/prerequisite/i)
    })
  })
})
