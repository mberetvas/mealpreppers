import { describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import {
  ANON_PLANNING_SESSION_COOKIE,
  resolvePlanningPrincipalFromEvent,
} from '../../server/services/planning/planningPrincipal'

/** Builds a minimal H3Event-like object with optional cookie header. */
function fakeEvent(cookieValue?: string): H3Event {
  const headers: Record<string, string> = {}
  if (cookieValue !== undefined) {
    headers.cookie = `${ANON_PLANNING_SESSION_COOKIE}=${cookieValue}`
  }
  return {
    node: {
      req: { headers },
      res: { setHeader: vi.fn(), getHeader: vi.fn(() => undefined) },
    },
    context: {},
  } as unknown as H3Event
}

describe('resolvePlanningPrincipalFromEvent', () => {
  it('returns user principal when resolver provides a userId', async () => {
    const event = fakeEvent()
    const resolver = vi.fn().mockResolvedValue('user-abc')

    const principal = await resolvePlanningPrincipalFromEvent(event, resolver)

    expect(resolver).toHaveBeenCalledWith(event)
    expect(principal).toEqual({ kind: 'user', userId: 'user-abc' })
  })

  it('returns anonymous principal with existing cookie when resolver returns null', async () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000'
    const event = fakeEvent(sessionId)
    const resolver = vi.fn().mockResolvedValue(null)

    const principal = await resolvePlanningPrincipalFromEvent(event, resolver)

    expect(principal).toEqual({ kind: 'anonymous', sessionId })
  })

  it('mints a new anonymous session when resolver returns null and no cookie exists', async () => {
    const event = fakeEvent()
    const resolver = vi.fn().mockResolvedValue(null)

    const principal = await resolvePlanningPrincipalFromEvent(event, resolver)

    expect(principal.kind).toBe('anonymous')
    if (principal.kind === 'anonymous') {
      expect(principal.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
    }
    // setCookie should have been called on the response
    const setCalls = (event.node.res.setHeader as ReturnType<typeof vi.fn>).mock.calls
    const cookieHeader = setCalls.find(
      (c: [string, ...unknown[]]) => c[0].toLowerCase() === 'set-cookie',
    )
    expect(cookieHeader).toBeDefined()
  })
})
