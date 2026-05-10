import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ANONYMOUS_SAVED_WEEKPLAN_IDLE_RETENTION_DAYS,
  anonymousSavedWeekplanIdleCutoffIso,
} from '../../server/services/planning/anonymousSavedWeekplansIdlePurge'
import { purgeAnonymousIdleSavedWeekplans } from '../../server/services/planning/savedWeekplansRepository'

describe('anonymousSavedWeekplanIdleCutoffIso', () => {
  it('uses updated_at semantics: cutoff is retention days before now (PRD idle definition)', () => {
    const now = new Date('2026-06-01T12:00:00.000Z')
    const expected = new Date(now.getTime() - ANONYMOUS_SAVED_WEEKPLAN_IDLE_RETENTION_DAYS * 86_400_000)
    expect(anonymousSavedWeekplanIdleCutoffIso(now)).toBe(expected.toISOString())
  })
})

describe('purgeAnonymousIdleSavedWeekplans selection', () => {
  it('deletes only anonymous-owned rows older than cutoff (never user-owned or legacy unowned)', async () => {
    const captured: { filters: string[][] } = { filters: [] }

    const chain: Record<string, unknown> = {
      is(col: string, val: unknown) {
        captured.filters.push(['is', col, String(val)])
        return chain
      },
      not(col: string, op: string, val: unknown) {
        captured.filters.push(['not', col, op, val === null ? 'null' : String(val)])
        return chain
      },
      lt(col: string, val: string) {
        captured.filters.push(['lt', col, val])
        return chain
      },
      select() {
        return {
          async then(resolve: (v: unknown) => void) {
            resolve({ data: [{ id: 'a' }, { id: 'b' }], error: null })
          },
        }
      },
    }

    const from = vi.fn(() => ({
      delete: vi.fn(() => chain),
    }))

    const client = { from } as unknown as SupabaseClient
    const fixedNow = new Date('2026-03-01T00:00:00.000Z')
    const cutoff = anonymousSavedWeekplanIdleCutoffIso(fixedNow)

    const result = await purgeAnonymousIdleSavedWeekplans(client, { now: fixedNow })

    expect(from).toHaveBeenCalledWith('meal_week_templates')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.deleted).toBe(2)
    }

    expect(captured.filters).toEqual([
      ['is', 'owner_user_id', 'null'],
      ['not', 'anon_session_id', 'is', 'null'],
      ['lt', 'updated_at', cutoff],
    ])
  })

  it('maps storage errors to planning failure', async () => {
    const chain = {
      is() {
        return chain
      },
      not() {
        return chain
      },
      lt() {
        return chain
      },
      select() {
        return {
          async then(resolve: (v: unknown) => void) {
            resolve({ data: null, error: { message: 'db down' } })
          },
        }
      },
    }

    const client = {
      from: () => ({ delete: () => chain }),
    } as unknown as SupabaseClient

    const result = await purgeAnonymousIdleSavedWeekplans(client, { now: new Date() })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('storage_error')
    }
  })
})
