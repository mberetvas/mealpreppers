/**
 * Unit tests for consolidation service with harness validation (issue #022).
 * Tests: polished path (harness passes), baseline_fallback path (harness rejects AI output).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StructuredLogger } from '../../server/utils/structuredLogger'
import type { ShoppingListPolishPort } from '../../server/services/shopping-list/polishPort'
import type { PlanningPrincipal } from '../../server/services/planning/planningPrincipal'
import { consolidateShoppingList } from '../../server/services/shopping-list/consolidationService'

// --- Mocks ---

const mocks = vi.hoisted(() => ({
  getSavedWeekplanById: vi.fn(),
  listRecipes: vi.fn(),
}))

vi.mock('../../server/services/planning/savedWeekplansRepository', () => ({
  getSavedWeekplanById: mocks.getSavedWeekplanById,
}))

vi.mock('../../server/services/recipe-catalog/recipeRepository', () => ({
  listRecipes: mocks.listRecipes,
}))

// --- Test helpers ---

const PLAN_ID = 'plan-harness-test'

function makeLogger(): StructuredLogger {
  return {
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}

function makePrincipal(): PlanningPrincipal {
  return { kind: 'anonymous', sessionId: '550e8400-e29b-41d4-a716-446655440000' }
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

function makeRecipe(id: string, title: string, ingredients: Array<{ name: string, quantity: number, unit: string }>) {
  return {
    id,
    title,
    categories: [],
    tags: [],
    ingredients: ingredients.map((ing, idx) => ({
      id: `ing-${id}-${idx}`,
      position: idx + 1,
      rawText: `${ing.quantity} ${ing.unit} ${ing.name}`,
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
    })),
    steps: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

// --- Tests ---

describe('consolidation service with harness validation (issue #022)', () => {
  let logger: StructuredLogger

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
    mocks.getSavedWeekplanById.mockResolvedValue({ ok: true, value: makeSavedWeekplan() })
    mocks.listRecipes.mockResolvedValue({
      ok: true,
      value: [makeRecipe('recipe-1', 'Pasta', [
        { name: 'pasta', quantity: 400, unit: 'g' },
        { name: 'olijfolie', quantity: 2, unit: 'el' },
      ])],
    })
  })

  describe('polished path (harness passes)', () => {
    it('returns polishStatus "polished" when AI output passes harness validation', async () => {
      const mockPort: ShoppingListPolishPort = {
        polish: vi.fn().mockResolvedValue({
          response: {
            lines: [
              { id: 'L1', name: 'Fusilli', quantity: 400, unit: 'g' },
              { id: 'L2', name: 'Olijfolie', quantity: 2, unit: 'el' },
            ],
            changes: [{ id: 'L1', reason: 'Renamed to store label' }],
          },
        }),
      }

      const result = await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: mockPort,
        openrouterApiKey: 'sk-test-key',
      })

      expect(result.polishStatus).toBe('polished')
      expect(result.consolidatedLines[0].name).toBe('Fusilli')
      expect(result.changes).toHaveLength(1)
    })

    it('uses polished lines as consolidatedLines when harness passes', async () => {
      const mockPort: ShoppingListPolishPort = {
        polish: vi.fn().mockResolvedValue({
          response: {
            lines: [
              { id: 'L1', name: 'Penne', quantity: 400, unit: 'g' },
              { id: 'L2', name: 'Extra vierge olijfolie', quantity: 2, unit: 'el' },
            ],
            changes: [
              { id: 'L1', reason: 'Specific pasta type' },
              { id: 'L2', reason: 'Dutch store label' },
            ],
          },
        }),
      }

      const result = await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: mockPort,
        openrouterApiKey: 'sk-test-key',
      })

      expect(result.polishStatus).toBe('polished')
      expect(result.consolidatedLines).toHaveLength(2)
      expect(result.consolidatedLines[0].name).toBe('Penne')
      expect(result.consolidatedLines[1].name).toBe('Extra vierge olijfolie')
      expect(result.baselineLines[0].name).toBe('pasta')
    })

    it('does not trigger a second attempt (no repair loop)', async () => {
      const mockPort: ShoppingListPolishPort = {
        polish: vi.fn().mockResolvedValue({
          response: {
            lines: [
              { id: 'L1', name: 'pasta', quantity: 400, unit: 'g' },
              { id: 'L2', name: 'olijfolie', quantity: 2, unit: 'el' },
            ],
          },
        }),
      }

      await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: mockPort,
        openrouterApiKey: 'sk-test-key',
      })

      expect(mockPort.polish).toHaveBeenCalledOnce()
    })
  })

  describe('baseline_fallback path (harness rejects AI output)', () => {
    it('returns polishStatus "baseline_fallback" when AI output invents ingredients', async () => {
      const mockPort: ShoppingListPolishPort = {
        polish: vi.fn().mockResolvedValue({
          response: {
            lines: [
              { id: 'L1', name: 'pasta', quantity: 400, unit: 'g' },
              { id: 'L2', name: 'olijfolie', quantity: 2, unit: 'el' },
              { id: 'L99', name: 'invented-item', quantity: 1, unit: 'stuks' },
            ],
          },
        }),
      }

      const result = await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: mockPort,
        openrouterApiKey: 'sk-test-key',
      })

      expect(result.polishStatus).toBe('baseline_fallback')
      expect(result.consolidatedLines).toEqual(result.baselineLines)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('returns polishStatus "baseline_fallback" when AI inflates quantity', async () => {
      const mockPort: ShoppingListPolishPort = {
        polish: vi.fn().mockResolvedValue({
          response: {
            lines: [
              { id: 'L1', name: 'pasta', quantity: 9999, unit: 'g' },
              { id: 'L2', name: 'olijfolie', quantity: 2, unit: 'el' },
            ],
          },
        }),
      }

      const result = await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: mockPort,
        openrouterApiKey: 'sk-test-key',
      })

      expect(result.polishStatus).toBe('baseline_fallback')
      expect(result.consolidatedLines).toEqual(result.baselineLines)
    })

    it('returns baseline_fallback with warning when harness rejects', async () => {
      const mockPort: ShoppingListPolishPort = {
        polish: vi.fn().mockResolvedValue({
          response: {
            lines: [
              { id: 'L1', name: 'pasta', quantity: 400, unit: 'kg' }, // unit-policy violation
              { id: 'L2', name: 'olijfolie', quantity: 2, unit: 'el' },
            ],
          },
        }),
      }

      const result = await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: mockPort,
        openrouterApiKey: 'sk-test-key',
      })

      expect(result.polishStatus).toBe('baseline_fallback')
      expect(result.warnings[0]).toContain('harness')
    })

    it('does not retry when harness fails (single attempt per retry policy v1)', async () => {
      const mockPort: ShoppingListPolishPort = {
        polish: vi.fn().mockResolvedValue({
          response: {
            lines: [
              { id: 'L99', name: 'invented', quantity: 1, unit: 'stuks' },
            ],
          },
        }),
      }

      await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: mockPort,
        openrouterApiKey: 'sk-test-key',
      })

      expect(mockPort.polish).toHaveBeenCalledOnce()
    })

    it('logs warning on harness failure', async () => {
      const mockPort: ShoppingListPolishPort = {
        polish: vi.fn().mockResolvedValue({
          response: {
            lines: [
              { id: 'L99', name: 'invented', quantity: 1, unit: 'stuks' },
            ],
          },
        }),
      }

      await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: mockPort,
        openrouterApiKey: 'sk-test-key',
      })

      expect(logger.warn).toHaveBeenCalledWith(
        'shopping_list.polish_harness_failed',
        expect.objectContaining({ failureCount: expect.any(Number) }),
      )
    })
  })

  describe('polish port throws (network/timeout error)', () => {
    it('returns baseline_fallback when polish port throws', async () => {
      const mockPort: ShoppingListPolishPort = {
        polish: vi.fn().mockRejectedValue(new Error('Network timeout')),
      }

      const result = await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: mockPort,
        openrouterApiKey: 'sk-test-key',
      })

      expect(result.polishStatus).toBe('baseline_fallback')
      expect(result.consolidatedLines).toEqual(result.baselineLines)
      expect(result.warnings[0]).toContain('failed')
    })
  })
})
