import { describe, expect, it } from 'vitest'
import { emptyWeekPlan, deepCloneWeek } from '../../utils/weekPlan'
import {
  clearPlannerWeekDraftSnapshot,
  parsePlannerWeekDraftSnapshot,
  plannerDraftHasMeaningfulEdits,
  plannerUnsavedSavedWeekplanDraftNeedsGuard,
  readPlannerWeekDraftSnapshot,
  serializePlannerWeekDraftSnapshot,
  shouldApplyStoredPlannerWeekDraftSnapshot,
  writePlannerWeekDraftSnapshot,
} from '../../utils/plannerDraftRecovery'

function weekWithOneRecipe(): ReturnType<typeof emptyWeekPlan> {
  const w = emptyWeekPlan()
  const next = deepCloneWeek(w)
  next.days['1'].breakfast = { recipeId: '00000000-0000-4000-8000-000000000001' }
  return next
}

describe('plannerDraftHasMeaningfulEdits', () => {
  it('is false for empty week and blank title', () => {
    expect(plannerDraftHasMeaningfulEdits(emptyWeekPlan(), '')).toBe(false)
    expect(plannerDraftHasMeaningfulEdits(emptyWeekPlan(), '   ')).toBe(false)
  })

  it('is true when title is non-empty after trim', () => {
    expect(plannerDraftHasMeaningfulEdits(emptyWeekPlan(), '  x  ')).toBe(true)
  })

  it('is true when any recipe slot is set', () => {
    expect(plannerDraftHasMeaningfulEdits(weekWithOneRecipe(), '')).toBe(true)
  })
})

describe('plannerUnsavedSavedWeekplanDraftNeedsGuard', () => {
  it('is false when linked to server row', () => {
    expect(plannerUnsavedSavedWeekplanDraftNeedsGuard('saved-weekplan', weekWithOneRecipe(), 'a')).toBe(false)
    expect(plannerUnsavedSavedWeekplanDraftNeedsGuard('week-template', weekWithOneRecipe(), '')).toBe(false)
  })

  it('is false for blank draft', () => {
    expect(plannerUnsavedSavedWeekplanDraftNeedsGuard('none', emptyWeekPlan(), '')).toBe(false)
  })

  it('is true for unsaved draft with meaningful edits', () => {
    expect(plannerUnsavedSavedWeekplanDraftNeedsGuard('none', weekWithOneRecipe(), '')).toBe(true)
    expect(plannerUnsavedSavedWeekplanDraftNeedsGuard('none', emptyWeekPlan(), 'My week')).toBe(true)
  })
})

describe('serializePlannerWeekDraftSnapshot / parsePlannerWeekDraftSnapshot', () => {
  it('round-trips a valid v1 snapshot', () => {
    const snap = {
      v: 1 as const,
      weekPlan: weekWithOneRecipe(),
      weekPlanTitle: 'Meals',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const raw = serializePlannerWeekDraftSnapshot(snap)
    const parsed = parsePlannerWeekDraftSnapshot(raw)
    expect(parsed).toEqual({ ok: true, value: snap })
  })

  it('rejects invalid JSON', () => {
    expect(parsePlannerWeekDraftSnapshot('not json')).toEqual({ ok: false })
  })

  it('rejects wrong version', () => {
    const raw = JSON.stringify({ v: 2, weekPlan: emptyWeekPlan(), weekPlanTitle: '', updatedAt: 'x' })
    expect(parsePlannerWeekDraftSnapshot(raw)).toEqual({ ok: false })
  })
})

describe('readPlannerWeekDraftSnapshot / writePlannerWeekDraftSnapshot / clearPlannerWeekDraftSnapshot', () => {
  it('writes, reads, and clears via in-memory storage', () => {
    const mem = new Map<string, string>()
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => { mem.set(k, v) },
      removeItem: (k: string) => { mem.delete(k) },
    }
    const key = 't-key'
    const snap = {
      v: 1 as const,
      weekPlan: weekWithOneRecipe(),
      weekPlanTitle: 'A',
      updatedAt: '2026-01-02T00:00:00.000Z',
    }
    writePlannerWeekDraftSnapshot(storage, key, snap)
    expect(readPlannerWeekDraftSnapshot(storage, key)).toEqual(snap)
    clearPlannerWeekDraftSnapshot(storage, key)
    expect(readPlannerWeekDraftSnapshot(storage, key)).toBeNull()
  })
})

describe('shouldApplyStoredPlannerWeekDraftSnapshot', () => {
  const snap = {
    v: 1 as const,
    weekPlan: weekWithOneRecipe(),
    weekPlanTitle: 'R',
    updatedAt: '2026-01-03T00:00:00.000Z',
  }

  it('does not apply when route requests a template', () => {
    expect(shouldApplyStoredPlannerWeekDraftSnapshot({
      routeHasTemplateQuery: true,
      persistenceKind: 'none',
      currentWeek: emptyWeekPlan(),
      currentTitle: '',
      snapshot: snap,
    })).toBe(false)
  })

  it('does not apply when persistence is not draft', () => {
    expect(shouldApplyStoredPlannerWeekDraftSnapshot({
      routeHasTemplateQuery: false,
      persistenceKind: 'saved-weekplan',
      currentWeek: emptyWeekPlan(),
      currentTitle: '',
      snapshot: snap,
    })).toBe(false)
  })

  it('does not apply when snapshot is null', () => {
    expect(shouldApplyStoredPlannerWeekDraftSnapshot({
      routeHasTemplateQuery: false,
      persistenceKind: 'none',
      currentWeek: emptyWeekPlan(),
      currentTitle: '',
      snapshot: null,
    })).toBe(false)
  })

  it('does not apply when current in-memory draft already has meaningful edits', () => {
    expect(shouldApplyStoredPlannerWeekDraftSnapshot({
      routeHasTemplateQuery: false,
      persistenceKind: 'none',
      currentWeek: weekWithOneRecipe(),
      currentTitle: '',
      snapshot: snap,
    })).toBe(false)
  })

  it('does not apply when snapshot itself is empty', () => {
    expect(shouldApplyStoredPlannerWeekDraftSnapshot({
      routeHasTemplateQuery: false,
      persistenceKind: 'none',
      currentWeek: emptyWeekPlan(),
      currentTitle: '',
      snapshot: { v: 1, weekPlan: emptyWeekPlan(), weekPlanTitle: '', updatedAt: 'x' },
    })).toBe(false)
  })

  it('applies when in-memory is blank and snapshot has meaningful content', () => {
    expect(shouldApplyStoredPlannerWeekDraftSnapshot({
      routeHasTemplateQuery: false,
      persistenceKind: 'none',
      currentWeek: emptyWeekPlan(),
      currentTitle: '',
      snapshot: snap,
    })).toBe(true)
  })
})
