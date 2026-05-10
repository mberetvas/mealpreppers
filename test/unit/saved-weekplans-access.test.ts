import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { emptyWeekPlan } from '../../utils/weekPlan'
import { interpretSavedWeekplanAccess } from '../../server/services/planning/savedWeekplanAccess'
import { updateSavedWeekplan } from '../../server/services/planning/savedWeekplansRepository'

describe('interpretSavedWeekplanAccess', () => {
  it('treats both-null owner columns as legacy unowned', () => {
    expect(interpretSavedWeekplanAccess(
      { owner_user_id: null, anon_session_id: null },
      { kind: 'anonymous', sessionId: 'any' },
    )).toBe('legacy_unowned')
  })

  it('matches anonymous principal when anon_session_id equals session', () => {
    expect(interpretSavedWeekplanAccess(
      { owner_user_id: null, anon_session_id: 'sess-1' },
      { kind: 'anonymous', sessionId: 'sess-1' },
    )).toBe('matched')
  })

  it('returns wrong_owner when anon_session_id differs (cross-owner)', () => {
    expect(interpretSavedWeekplanAccess(
      { owner_user_id: null, anon_session_id: 'sess-owner' },
      { kind: 'anonymous', sessionId: 'sess-intruder' },
    )).toBe('wrong_owner')
  })

  it('matches user principal when owner_user_id equals user id', () => {
    expect(interpretSavedWeekplanAccess(
      { owner_user_id: 'user-1', anon_session_id: null },
      { kind: 'user', userId: 'user-1' },
    )).toBe('matched')
  })

  it('returns wrong_owner for user-owned row when principal is anonymous', () => {
    expect(interpretSavedWeekplanAccess(
      { owner_user_id: 'user-1', anon_session_id: null },
      { kind: 'anonymous', sessionId: 'sess-1' },
    )).toBe('wrong_owner')
  })
})

describe('updateSavedWeekplan cross-owner', () => {
  it('returns forbidden without mutating when row belongs to another anonymous session', async () => {
    const body = emptyWeekPlan()
    const existingRow = {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Other',
      body,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      owner_user_id: null,
      anon_session_id: 'their-session',
    }

    const updateChain = vi.fn()

    const client = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: existingRow, error: null }),
                }
              },
            }
          },
          update: updateChain,
        }
      },
    } as unknown as SupabaseClient

    const result = await updateSavedWeekplan(
      client,
      existingRow.id,
      { kind: 'anonymous', sessionId: 'my-session' },
      { name: 'Renamed' },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('forbidden')
    expect(updateChain).not.toHaveBeenCalled()
  })
})
