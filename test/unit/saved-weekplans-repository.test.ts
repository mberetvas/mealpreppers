import { describe, expect, it } from 'vitest'
import * as planningRepository from '../../server/services/planning/planningRepository'
import * as savedWeekplansRepository from '../../server/services/planning/savedWeekplansRepository'

describe('planningRepository week-template surface removed', () => {
  it('does not export unscoped week-template CRUD', () => {
    expect('listWeekTemplates' in planningRepository).toBe(false)
    expect('getWeekTemplateById' in planningRepository).toBe(false)
    expect('createWeekTemplate' in planningRepository).toBe(false)
    expect('updateWeekTemplate' in planningRepository).toBe(false)
    expect('deleteWeekTemplate' in planningRepository).toBe(false)
  })
})

describe('savedWeekplansRepository legacy week-template surface removed', () => {
  it('does not export unscoped week-template CRUD used by retired routes', () => {
    expect('listWeekTemplates' in savedWeekplansRepository).toBe(false)
    expect('getWeekTemplateById' in savedWeekplansRepository).toBe(false)
    expect('createWeekTemplate' in savedWeekplansRepository).toBe(false)
    expect('updateWeekTemplate' in savedWeekplansRepository).toBe(false)
    expect('deleteWeekTemplate' in savedWeekplansRepository).toBe(false)
  })
})
