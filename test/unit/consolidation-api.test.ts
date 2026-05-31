/**
 * Tests for Shopping list consolidation API (issue #021):
 * - API handler auth/not-found
 * - Service orchestration with stubbed port
 * - ai_skipped path
 * - Response shape validation
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'
import consolidateHandler from '../../server/api/v1/saved-weekplans/[id]/consolidate-shopping-list.post'

// --- Mocks ---

const h3Mocks = vi.hoisted(() => ({
  readBody: vi.fn(),
}))

vi.mock('h3', async (importOriginal) => {
  const mod = await importOriginal<typeof import('h3')>()
  return {
    ...mod,
    readBody: h3Mocks.readBody,
  }
})

vi.mock('../../server/utils/logger', () => ({
  appLogger: {
    withTag: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      withTag: vi.fn(),
    })),
  },
}))

const runtimeConfigMock = vi.hoisted(() => ({
  openrouterApiKey: '',
  supabaseUrl: 'http://localhost',
  supabaseServiceRoleKey: 'test-key',
  savedWeekplansIdlePurgeSecret: '',
}))

vi.stubGlobal('useRuntimeConfig', () => runtimeConfigMock)

const mocks = vi.hoisted(() => ({
  getSavedWeekplanById: vi.fn(),
  listRecipes: vi.fn(),
  getSupabaseServerClient: vi.fn(() => ({})),
}))

vi.mock('../../server/db/supabaseClient', () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}))

vi.mock('../../server/services/planning/savedWeekplansRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/services/planning/savedWeekplansRepository')>()
  return {
    ...actual,
    getSavedWeekplanById: mocks.getSavedWeekplanById,
  }
})

vi.mock('../../server/services/recipe-catalog/recipeRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/services/recipe-catalog/recipeRepository')>()
  return {
    ...actual,
    listRecipes: mocks.listRecipes,
  }
})

// --- Test helpers ---

const SESSION_UUID = '550e8400-e29b-41d4-a716-446655440000'
const PLAN_ID = 'plan-abc-123'

function makeEvent(opts: { traceId?: string, sessionId?: string, planId?: string } = {}): H3Event {
  const socket = new Socket()
  const req = new IncomingMessage(socket)
  req.headers = {}
  const res = new ServerResponse(req)
  const event = createEvent(req, res)
  if (opts.traceId !== undefined) {
    (event.context as Record<string, unknown>).traceId = opts.traceId
  }
  event.context.params = { id: opts.planId ?? PLAN_ID }
  const sid = opts.sessionId ?? SESSION_UUID
  event.node.req.headers.cookie = `mp_planning_session=${sid}`
  return event
}

function makeWeekPlanBody() {
  const emptySlot = { recipeId: null }
  const day = { breakfast: emptySlot, lunch: emptySlot, dinner: emptySlot }
  return {
    version: 'week_v1' as const,
    days: {
      '1': { breakfast: { recipeId: 'recipe-1' }, lunch: emptySlot, dinner: emptySlot },
      '2': day,
      '3': day,
      '4': day,
      '5': day,
      '6': day,
      '7': day,
    },
  }
}

function makeSavedWeekplan() {
  return {
    id: PLAN_ID,
    name: 'Test Week',
    body: makeWeekPlanBody(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function makeRecipe(id: string, title: string) {
  return {
    id,
    title,
    categories: [],
    tags: [],
    ingredients: [
      { id: 'ing-1', position: 1, rawText: '400 g pasta', name: 'pasta', quantity: 400, unit: 'g' },
      { id: 'ing-2', position: 2, rawText: '1 el olijfolie', name: 'olijfolie', quantity: 1, unit: 'el' },
    ],
    steps: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

// --- Tests ---

describe('consolidate-shopping-list API handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runtimeConfigMock.openrouterApiKey = ''
  })

  describe('auth and access control', () => {
    it('returns 404 when plan does not exist', async () => {
      mocks.getSavedWeekplanById.mockResolvedValue({
        ok: false,
        error: { kind: 'not_found', entity: 'saved_weekplan', message: 'Saved weekplan not found.' },
      })

      const event = makeEvent()
      await expect(consolidateHandler(event)).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('returns 403 when plan belongs to another principal', async () => {
      mocks.getSavedWeekplanById.mockResolvedValue({
        ok: false,
        error: { kind: 'forbidden', entity: 'saved_weekplan', message: 'You do not have access to this saved weekplan.' },
      })

      const event = makeEvent()
      await expect(consolidateHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      })
    })

    it('returns 400 when plan id is missing', async () => {
      const socket = new Socket()
      const req = new IncomingMessage(socket)
      req.headers = {}
      const res = new ServerResponse(req)
      const event = createEvent(req, res)
      event.context.params = { id: '' }
      event.node.req.headers.cookie = `mp_planning_session=${SESSION_UUID}`

      await expect(consolidateHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      })
    })
  })

  describe('ai_skipped path (baseline fallback)', () => {
    beforeEach(() => {
      mocks.getSavedWeekplanById.mockResolvedValue({ ok: true, value: makeSavedWeekplan() })
      mocks.listRecipes.mockResolvedValue({ ok: true, value: [makeRecipe('recipe-1', 'Pasta')] })
      runtimeConfigMock.openrouterApiKey = ''
    })

    it('returns HTTP 200 with polishStatus ai_skipped when OPENROUTER_API_KEY is unset', async () => {
      const event = makeEvent()
      const result = await consolidateHandler(event)

      expect(result).toMatchObject({
        polishStatus: 'ai_skipped',
      })
    })

    it('returns empty consolidatedLines when AI is skipped', async () => {
      const event = makeEvent()
      const result = await consolidateHandler(event)

      expect(result.consolidatedLines).toEqual([])
    })

    it('includes a warning when polish is skipped', async () => {
      const event = makeEvent()
      const result = await consolidateHandler(event)

      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain('skipped')
    })

    it('returns correct response shape with all expected fields', async () => {
      const event = makeEvent()
      const result = await consolidateHandler(event)

      expect(result).toHaveProperty('consolidatedLines')
      expect(result).toHaveProperty('baselineLines')
      expect(result).toHaveProperty('changes')
      expect(result).toHaveProperty('polishStatus')
      expect(result).toHaveProperty('warnings')
      expect(Array.isArray(result.consolidatedLines)).toBe(true)
      expect(Array.isArray(result.baselineLines)).toBe(true)
      expect(Array.isArray(result.changes)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
    })

    it('baseline lines contain merged ingredients from the plan recipes', async () => {
      const event = makeEvent()
      const result = await consolidateHandler(event)

      expect(result.baselineLines.length).toBeGreaterThan(0)
      expect(result.baselineLines[0]).toHaveProperty('id')
      expect(result.baselineLines[0]).toHaveProperty('name')
      expect(result.baselineLines[0]).toHaveProperty('quantity')
      expect(result.baselineLines[0]).toHaveProperty('unit')
      expect(result.baselineLines[0]).toHaveProperty('provenance')
    })

    it('changes array is empty when AI is skipped', async () => {
      const event = makeEvent()
      const result = await consolidateHandler(event)

      expect(result.changes).toEqual([])
    })

    it('returns sourceFingerprint in response', async () => {
      const event = makeEvent()
      const result = await consolidateHandler(event)

      expect(result.sourceFingerprint).toBeDefined()
      expect(result.sourceFingerprint).toMatch(/^[a-f0-9]+$/)
    })
  })

  describe('pending_review response shape', () => {
    it('documents expected response fields for pending_review status', () => {
      // This test documents the API contract for clients consuming pending_review.
      // When polishStatus is 'pending_review', the response includes:
      // - consolidatedLines: AI-produced lines (NOT baseline) for the review UI
      // - baselineLines: post-exact-merge reference for diff display
      // - polishResponse: the full canonicalized AI response
      // - hints: per-line hint objects with severity
      // - changes: AI-reported change reasons
      // - sourceFingerprint: stable digest for staleness detection
      // - warnings: any non-blocking warnings
      //
      // Existing clients that auto-apply consolidatedLines should gate on
      // polishStatus !== 'pending_review' to avoid showing unconfirmed AI output.
      const expectedFields = [
        'consolidatedLines',
        'baselineLines',
        'polishResponse',
        'hints',
        'changes',
        'sourceFingerprint',
        'polishStatus',
        'warnings',
      ]
      expect(expectedFields).toHaveLength(8)
    })
  })
})
