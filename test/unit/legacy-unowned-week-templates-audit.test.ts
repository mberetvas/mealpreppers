import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  auditLegacyUnownedWeekTemplates,
  DEFAULT_LEGACY_UNOWNED_SAMPLE_LIMIT,
} from '../../server/services/planning/auditLegacyUnownedWeekTemplates'

describe('auditLegacyUnownedWeekTemplates', () => {
  it('counts rows where both owner columns are null and returns sample ids', async () => {
    const captured: { filters: string[][] } = { filters: [] }

    const countChain: Record<string, unknown> = {
      select(_cols: string, _opts: unknown) {
        return countChain
      },
      is(col: string, val: unknown) {
        captured.filters.push(['is', col, String(val)])
        return countChain
      },
      async then(resolve: (v: unknown) => void) {
        resolve({ count: 3, error: null })
      },
    }

    const sampleChain: Record<string, unknown> = {
      select() {
        return sampleChain
      },
      is(col: string, val: unknown) {
        captured.filters.push(['is', col, String(val)])
        return sampleChain
      },
      order() {
        return sampleChain
      },
      limit(n: number) {
        captured.filters.push(['limit', String(n)])
        return sampleChain
      },
      async then(resolve: (v: unknown) => void) {
        resolve({
          data: [{ id: 'id-a' }, { id: 'id-b' }],
          error: null,
        })
      },
    }

    let call = 0
    const from = vi.fn(() => {
      call += 1
      return call === 1 ? countChain : sampleChain
    })

    const client = { from } as unknown as SupabaseClient

    const result = await auditLegacyUnownedWeekTemplates(client)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.count).toBe(3)
      expect(result.value.sampleIds).toEqual(['id-a', 'id-b'])
    }

    expect(from).toHaveBeenCalledTimes(2)
    expect(from).toHaveBeenCalledWith('meal_week_templates')
    expect(captured.filters.filter(f => f[0] === 'is')).toEqual([
      ['is', 'owner_user_id', 'null'],
      ['is', 'anon_session_id', 'null'],
      ['is', 'owner_user_id', 'null'],
      ['is', 'anon_session_id', 'null'],
    ])
    expect(captured.filters).toContainEqual(['limit', String(DEFAULT_LEGACY_UNOWNED_SAMPLE_LIMIT)])
  })

  it('skips sample query when count is zero', async () => {
    const countChain = {
      select() {
        return countChain
      },
      is() {
        return countChain
      },
      async then(resolve: (v: unknown) => void) {
        resolve({ count: 0, error: null })
      },
    }

    const from = vi.fn(() => countChain)
    const client = { from } as unknown as SupabaseClient

    const result = await auditLegacyUnownedWeekTemplates(client)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.count).toBe(0)
      expect(result.value.sampleIds).toEqual([])
    }
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('maps storage errors to planning failure', async () => {
    const countChain = {
      select() {
        return countChain
      },
      is() {
        return countChain
      },
      async then(resolve: (v: unknown) => void) {
        resolve({ count: null, error: { message: 'db down' } })
      },
    }

    const client = { from: vi.fn(() => countChain) } as unknown as SupabaseClient
    const result = await auditLegacyUnownedWeekTemplates(client)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('storage_error')
  })
})
