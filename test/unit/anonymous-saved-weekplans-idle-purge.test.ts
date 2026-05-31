import { describe, expect, it } from 'vitest'
import {
  ANONYMOUS_SAVED_WEEKPLAN_IDLE_RETENTION_DAYS,
  anonymousSavedWeekplanIdleCutoffIso,
} from '../../server/services/planning/anonymousSavedWeekplansIdlePurge'

describe('anonymousSavedWeekplanIdleCutoffIso', () => {
  it('uses updated_at semantics: cutoff is retention days before now (PRD idle definition)', () => {
    const now = new Date('2026-06-01T12:00:00.000Z')
    const expected = new Date(now.getTime() - ANONYMOUS_SAVED_WEEKPLAN_IDLE_RETENTION_DAYS * 86_400_000)
    expect(anonymousSavedWeekplanIdleCutoffIso(now)).toBe(expected.toISOString())
  })
})

/** Purge selection against SQLite is covered in `planning-sqlite-repository.test.ts`. */
