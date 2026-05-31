import { describe, expect, it } from 'vitest'
import { interpretSavedWeekplanAccess } from '../../server/services/planning/savedWeekplanAccess'

describe('interpretSavedWeekplanAccess', () => {
  it('returns legacy_unowned when both owner columns are null', () => {
    expect(interpretSavedWeekplanAccess(
      { owner_user_id: null, anon_session_id: null },
      { kind: 'user', userId: 'user-1' },
    )).toBe('legacy_unowned')
  })

  it('matches when owner_user_id equals the local principal userId', () => {
    expect(interpretSavedWeekplanAccess(
      { owner_user_id: 'user-1', anon_session_id: null },
      { kind: 'user', userId: 'user-1' },
    )).toBe('matched')
  })

  it('returns wrong_owner when owner_user_id differs', () => {
    expect(interpretSavedWeekplanAccess(
      { owner_user_id: 'user-owner', anon_session_id: null },
      { kind: 'user', userId: 'user-intruder' },
    )).toBe('wrong_owner')
  })
})
