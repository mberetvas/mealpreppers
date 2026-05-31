import { describe, expect, it } from 'vitest'
import { interpretSavedWeekplanAccess } from '../../server/services/planning/savedWeekplanAccess'

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

/** Cross-owner update behavior is covered in `planning-sqlite-repository.test.ts`. */
