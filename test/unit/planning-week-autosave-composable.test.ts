import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Issue 004: week grid autosave PATCH uses Saved Weekplans only (no legacy week-templates branch).
 */
describe('usePlanningWeekAutosave (issue 004)', () => {
  const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
  const source = readFileSync(
    join(repoRoot, 'app', 'composables', 'usePlanningWeekAutosave.ts'),
    'utf8',
  )

  it('PATCH path is always /api/v1/saved-weekplans/:id', () => {
    expect(source).toContain('/api/v1/saved-weekplans/${id}')
    expect(source).not.toContain('/api/v1/planning/week-templates')
  })

  it('persistence kind excludes legacy week-template', () => {
    expect(source).not.toContain("'week-template'")
    expect(source).toContain("'saved-weekplan'")
  })
})
