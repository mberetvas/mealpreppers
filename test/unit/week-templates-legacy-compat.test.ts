import { describe, expect, it } from 'vitest'
import {
  createWeekTemplate,
  listWeekTemplates,
} from '../../server/services/planning/planningRepository'

/**
 * Legacy `/api/v1/planning/week-templates` must keep using unscoped list/create
 * until callers migrate to Saved Weekplans routes (see `server/api/v1/planning/week-templates/DEPRECATED.md`).
 */
describe('legacy week-templates repository surface', () => {
  it('exports listWeekTemplates with a single Supabase client argument', () => {
    expect(listWeekTemplates.length).toBe(1)
  })

  it('exports createWeekTemplate with two arguments: Supabase client and template input', () => {
    expect(createWeekTemplate.length).toBe(2)
  })
})
