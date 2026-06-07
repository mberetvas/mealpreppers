import { describe, expect, it } from 'vitest'
import { emptyWeekPlan } from '../../utils/weekPlan'
import { InMemorySavedWeekplanReader } from '../../server/services/planning/infrastructure/inMemorySavedWeekplanReader'
import {
  getSavedWeekplanById,
  listSavedWeekplans,
} from '../../server/services/planning/savedWeekplansRepository'

const body = emptyWeekPlan()
const now = '2026-01-01T00:00:00.000Z'

describe('SavedWeekplanReader seam (in-memory fake)', () => {
  it('lists only rows owned by the principal', async () => {
    const reader = new InMemorySavedWeekplanReader([
      {
        id: 'plan-mine',
        name: 'Mine',
        body,
        createdAt: now,
        updatedAt: now,
        ownerUserId: 'user-1',
        anonSessionId: null,
        consolidatedShoppingList: null,
      },
      {
        id: 'plan-theirs',
        name: 'Theirs',
        body,
        createdAt: now,
        updatedAt: now,
        ownerUserId: 'user-2',
        anonSessionId: null,
        consolidatedShoppingList: null,
      },
    ])

    const result = await listSavedWeekplans({} as never, { kind: 'user', userId: 'user-1' }, reader)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveLength(1)
      expect(result.value[0]?.name).toBe('Mine')
    }
  })

  it('excludes legacy unowned rows from list', async () => {
    const reader = new InMemorySavedWeekplanReader([
      {
        id: 'plan-legacy',
        name: 'Legacy',
        body,
        createdAt: now,
        updatedAt: now,
        ownerUserId: null,
        anonSessionId: null,
        consolidatedShoppingList: null,
      },
      {
        id: 'plan-owned',
        name: 'Owned',
        body,
        createdAt: now,
        updatedAt: now,
        ownerUserId: 'user-1',
        anonSessionId: null,
        consolidatedShoppingList: null,
      },
    ])

    const result = await listSavedWeekplans({} as never, { kind: 'user', userId: 'user-1' }, reader)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveLength(1)
      expect(result.value[0]?.name).toBe('Owned')
    }
  })

  it('returns not_found for legacy unowned GET', async () => {
    const reader = new InMemorySavedWeekplanReader([
      {
        id: 'plan-legacy',
        name: 'Legacy',
        body,
        createdAt: now,
        updatedAt: now,
        ownerUserId: null,
        anonSessionId: null,
        consolidatedShoppingList: null,
      },
    ])

    const result = await getSavedWeekplanById(
      {} as never,
      'plan-legacy',
      { kind: 'user', userId: 'user-1' },
      reader,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('not_found')
      expect(result.error.entity).toBe('saved_weekplan')
    }
  })

  it('returns forbidden for wrong-owner GET', async () => {
    const reader = new InMemorySavedWeekplanReader([
      {
        id: 'plan-owned',
        name: 'Owned',
        body,
        createdAt: now,
        updatedAt: now,
        ownerUserId: 'user-owner',
        anonSessionId: null,
        consolidatedShoppingList: null,
      },
    ])

    const result = await getSavedWeekplanById(
      {} as never,
      'plan-owned',
      { kind: 'user', userId: 'user-intruder' },
      reader,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('forbidden')
  })
})
