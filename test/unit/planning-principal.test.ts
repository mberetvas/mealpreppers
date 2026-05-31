import { describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { resolvePlanningPrincipalFromEvent } from '../../server/services/planning/planningPrincipal'

const LOCAL_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

vi.mock('../../server/services/planning/localPrincipal', () => ({
  getLocalPlanningUserId: () => LOCAL_USER_ID,
}))

/** Builds a minimal H3Event-like object with optional planningUserId on context. */
function fakeEvent(planningUserId?: string): H3Event {
  return {
    context: planningUserId !== undefined ? { planningUserId } : {},
  } as unknown as H3Event
}

describe('resolvePlanningPrincipalFromEvent', () => {
  it('returns user principal from event context when planningUserId is set', () => {
    const event = fakeEvent('user-abc')

    const principal = resolvePlanningPrincipalFromEvent(event)

    expect(principal).toEqual({ kind: 'user', userId: 'user-abc' })
  })

  it('falls back to the local install user id when context is missing', () => {
    const event = fakeEvent()

    const principal = resolvePlanningPrincipalFromEvent(event)

    expect(principal).toEqual({ kind: 'user', userId: LOCAL_USER_ID })
  })
})
