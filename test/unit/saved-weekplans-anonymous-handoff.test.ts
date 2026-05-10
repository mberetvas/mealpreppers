import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  countAnonymousSavedWeekplansForSession,
  discardAnonymousSavedWeekplansForSession,
  mergeAnonymousSavedWeekplansToUser,
} from '../../server/services/planning/savedWeekplansRepository'

describe('countAnonymousSavedWeekplansForSession', () => {
  it('returns count from head query', async () => {
    const is = vi.fn(async () => ({ count: 3, error: null }))
    const eq = vi.fn(() => ({ is }))
    const client = {
      from() {
        return {
          select() {
            return { eq }
          },
        }
      },
    } as unknown as SupabaseClient

    const result = await countAnonymousSavedWeekplansForSession(client, 'sess-a')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe(3)
    expect(eq).toHaveBeenCalledWith('anon_session_id', 'sess-a')
    expect(is).toHaveBeenCalledWith('owner_user_id', null)
  })

  it('returns storage_error when Supabase errors', async () => {
    const client = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  is: async () => ({ count: null, error: { message: 'db down' } }),
                }
              },
            }
          },
        }
      },
    } as unknown as SupabaseClient

    const result = await countAnonymousSavedWeekplansForSession(client, 'sess-a')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('storage_error')
  })
})

describe('mergeAnonymousSavedWeekplansToUser', () => {
  it('returns moved count from updated row ids', async () => {
    const select = vi.fn(async () => ({
      error: null,
      data: [{ id: '1' }, { id: '2' }],
    }))
    const is = vi.fn(() => ({ select }))
    const eq = vi.fn(() => ({ is }))
    const updateChain = vi.fn(() => ({ eq }))
    const client = {
      from() {
        return { update: updateChain }
      },
    } as unknown as SupabaseClient

    const result = await mergeAnonymousSavedWeekplansToUser(client, 'sess-a', 'user-1')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.moved).toBe(2)
    expect(updateChain).toHaveBeenCalledWith(
      expect.objectContaining({ owner_user_id: 'user-1', anon_session_id: null }),
    )
  })

  it('returns storage_error on failure', async () => {
    const client = {
      from() {
        return {
          update: () => ({
            eq: () => ({
              is: () => ({
                select: async () => ({ error: { message: 'fail' }, data: null }),
              }),
            }),
          }),
        }
      },
    } as unknown as SupabaseClient

    const result = await mergeAnonymousSavedWeekplansToUser(client, 'sess-a', 'user-1')
    expect(result.ok).toBe(false)
  })
})

describe('discardAnonymousSavedWeekplansForSession', () => {
  it('returns deleted count from delete response rows', async () => {
    const select = vi.fn(async () => ({
      error: null,
      data: [{ id: 'a' }],
    }))
    const is = vi.fn(() => ({ select }))
    const eq = vi.fn(() => ({ is }))
    const deleteChain = vi.fn(() => ({ eq }))
    const client = {
      from() {
        return { delete: deleteChain }
      },
    } as unknown as SupabaseClient

    const result = await discardAnonymousSavedWeekplansForSession(client, 'sess-x')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.deleted).toBe(1)
  })
})
