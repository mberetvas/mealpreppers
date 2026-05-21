import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { emptyWeekPlan } from '../../utils/weekPlan'
import * as planningRepository from '../../server/services/planning/planningRepository'
import * as savedWeekplansRepository from '../../server/services/planning/savedWeekplansRepository'
import {
  createSavedWeekplan,
  deleteSavedWeekplan,
  getSavedWeekplanById,
  listSavedWeekplans,
} from '../../server/services/planning/savedWeekplansRepository'

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

describe('listSavedWeekplans principal scoping', () => {
  it('filters by owner_user_id for signed-in user principal', async () => {
    const is = vi.fn(() => ({ order: vi.fn(async () => ({ data: [], error: null })) }))
    const eq = vi.fn(() => ({ is }))
    const client = {
      from() {
        return { select: () => ({ eq }) }
      },
    } as unknown as SupabaseClient

    await listSavedWeekplans(client, { kind: 'user', userId: 'user-1' })

    expect(eq).toHaveBeenCalledWith('owner_user_id', 'user-1')
    expect(is).toHaveBeenCalledWith('anon_session_id', null)
  })

  it('filters by anon_session_id for anonymous principal', async () => {
    const is = vi.fn(() => ({ order: vi.fn(async () => ({ data: [], error: null })) }))
    const eq = vi.fn(() => ({ is }))
    const client = {
      from() {
        return { select: () => ({ eq }) }
      },
    } as unknown as SupabaseClient

    await listSavedWeekplans(client, { kind: 'anonymous', sessionId: 'sess-1' })

    expect(eq).toHaveBeenCalledWith('anon_session_id', 'sess-1')
    expect(is).toHaveBeenCalledWith('owner_user_id', null)
  })
})

describe('createSavedWeekplan owner columns', () => {
  it('sets owner_user_id and clears anon_session_id for user principal', async () => {
    const body = emptyWeekPlan()
    const insert = vi.fn(() => ({
      select: () => ({
        single: async () => ({
          data: {
            id: 'plan-1',
            name: 'Week',
            body,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            owner_user_id: 'user-1',
            anon_session_id: null,
          },
          error: null,
        }),
      }),
    }))
    const client = {
      from() {
        return { insert }
      },
    } as unknown as SupabaseClient

    const result = await createSavedWeekplan(
      client,
      { kind: 'user', userId: 'user-1' },
      { name: 'Week', body },
    )

    expect(result.ok).toBe(true)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Week',
        body,
        owner_user_id: 'user-1',
        anon_session_id: null,
      }),
    )
  })

  it('sets anon_session_id and clears owner_user_id for anonymous principal', async () => {
    const body = emptyWeekPlan()
    const insert = vi.fn(() => ({
      select: () => ({
        single: async () => ({
          data: {
            id: 'plan-1',
            name: 'Week',
            body,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            owner_user_id: null,
            anon_session_id: 'sess-1',
          },
          error: null,
        }),
      }),
    }))
    const client = {
      from() {
        return { insert }
      },
    } as unknown as SupabaseClient

    const result = await createSavedWeekplan(
      client,
      { kind: 'anonymous', sessionId: 'sess-1' },
      { name: 'Week', body },
    )

    expect(result.ok).toBe(true)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_user_id: null,
        anon_session_id: 'sess-1',
      }),
    )
  })
})

describe('getSavedWeekplanById access via interpretSavedWeekplanAccess', () => {
  const body = emptyWeekPlan()
  const legacyRow = {
    id: '00000000-0000-4000-8000-000000000099',
    name: 'Legacy',
    body,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    owner_user_id: null,
    anon_session_id: null,
  }

  it('returns not_found for legacy_unowned rows', async () => {
    const client = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: legacyRow, error: null }),
                }
              },
            }
          },
        }
      },
    } as unknown as SupabaseClient

    const result = await getSavedWeekplanById(
      client,
      legacyRow.id,
      { kind: 'user', userId: 'user-1' },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('not_found')
      expect(result.error.entity).toBe('saved_weekplan')
    }
  })

  it('returns forbidden for cross-owner anonymous row', async () => {
    const otherRow = {
      ...legacyRow,
      id: '00000000-0000-4000-8000-000000000002',
      anon_session_id: 'their-session',
    }
    const client = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: otherRow, error: null }),
                }
              },
            }
          },
        }
      },
    } as unknown as SupabaseClient

    const result = await getSavedWeekplanById(
      client,
      otherRow.id,
      { kind: 'anonymous', sessionId: 'my-session' },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('forbidden')
  })
})

describe('deleteSavedWeekplan principal scoping', () => {
  it('scopes delete to owner_user_id for user principal', async () => {
    const body = emptyWeekPlan()
    const ownedRow = {
      id: '00000000-0000-4000-8000-000000000003',
      name: 'Mine',
      body,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      owner_user_id: 'user-1',
      anon_session_id: null,
    }

    const is = vi.fn(() => ({
      select: () => ({
        maybeSingle: async () => ({ data: { id: ownedRow.id }, error: null }),
      }),
    }))
    const eqSecond = vi.fn(() => ({ is }))
    const eqFirst = vi.fn(() => ({ eq: eqSecond }))
    const deleteChain = vi.fn(() => ({ eq: eqFirst }))

    const client = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: ownedRow, error: null }),
                }
              },
            }
          },
          delete: deleteChain,
        }
      },
    } as unknown as SupabaseClient

    const result = await deleteSavedWeekplan(
      client,
      ownedRow.id,
      { kind: 'user', userId: 'user-1' },
    )

    expect(result.ok).toBe(true)
    expect(eqSecond).toHaveBeenCalledWith('owner_user_id', 'user-1')
    expect(is).toHaveBeenCalledWith('anon_session_id', null)
  })
})
