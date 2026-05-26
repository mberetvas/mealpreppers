/**
 * Unit tests for consolidation service with harness validation (issue #022, updated for #027).
 * Tests: polished path (harness passes), pending_review path (harness finds violations, model succeeded).
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
              { id: 'L1', name: 'pasta', quantity: 400, unit: 'g' },
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

      expect(result.polishStatus).toBe('polished')
      expect(result.consolidatedLines[0].name).toBe('pasta')
    })

    it('uses polished lines as consolidatedLines when harness passes', async () => {
      const mockPort: ShoppingListPolishPort = {
        polish: vi.fn().mockResolvedValue({
          response: {
            lines: [
              { id: 'L1', name: 'pasta', quantity: 0.4, unit: 'kg' },
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

      expect(result.polishStatus).toBe('polished')
      expect(result.consolidatedLines).toHaveLength(2)
      expect(result.consolidatedLines[0].name).toBe('pasta')
      expect(result.consolidatedLines[0].unit).toBe('kg')
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

  describe('pending_review path (harness finds violations but model succeeded)', () => {
    it('returns polishStatus "pending_review" when AI output invents ingredients', async () => {
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

      expect(result.polishStatus).toBe('pending_review')
      expect(result.hints).toBeDefined()
      expect(result.hints!.length).toBeGreaterThan(0)
      expect(result.polishResponse).toBeDefined()
    })

    it('returns polishStatus "pending_review" when AI inflates quantity', async () => {
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

      expect(result.polishStatus).toBe('pending_review')
      expect(result.hints).toContainEqual(expect.objectContaining({ rule: 'quantity-cap' }))
    })

    it('does not discard AI lines on harness violations', async () => {
      const mockPort: ShoppingListPolishPort = {
        polish: vi.fn().mockResolvedValue({
          response: {
            lines: [
              { id: 'L1', name: 'fusilli', quantity: 400, unit: 'g' },
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

      expect(result.polishStatus).toBe('pending_review')
      expect(result.consolidatedLines.find(l => l.id === 'L1')?.name).toBe('fusilli')
      expect(result.hints).toContainEqual(expect.objectContaining({ rule: 'name-unchanged' }))
    })

    it('includes polishResponse and hints in pending_review result', async () => {
      const mockPort: ShoppingListPolishPort = {
        polish: vi.fn().mockResolvedValue({
          response: {
            lines: [
              { id: 'L1', name: 'pasta', quantity: 400, unit: 'kg' },
              { id: 'L2', name: 'olijfolie', quantity: 2, unit: 'el' },
            ],
            changes: [{ id: 'L1', reason: 'unit changed' }],
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

      expect(result.polishStatus).toBe('pending_review')
      expect(result.polishResponse).toBeDefined()
      expect(result.polishResponse!.lines).toHaveLength(2)
      expect(result.hints).toBeDefined()
      expect(result.baselineLines).toHaveLength(2)
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

    it('logs pending_review with hint counts and failuresByRule', async () => {
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

      expect(logger.info).toHaveBeenCalledWith(
        'shopping_list.polish_pending_review',
        expect.objectContaining({
          planId: PLAN_ID,
          hintCount: expect.any(Number),
          failuresByRule: expect.any(Object),
        }),
      )
    })
  })

  describe('cross-unit baseline (deterministic pre-polish)', () => {
    it('merges g and kg into fewer baselineLines when AI is skipped', async () => {
      const crossUnitPlan = {
        ...makeSavedWeekplan(),
        body: {
          version: 'week_v1' as const,
          days: {
            '1': { breakfast: { recipeId: 'recipe-1' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
            '2': { breakfast: { recipeId: 'recipe-2' }, lunch: { recipeId: null }, dinner: { recipeId: null } },
            '3': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
            '4': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
            '5': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
            '6': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
            '7': { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
          },
        },
      }
      mocks.getSavedWeekplanById.mockResolvedValue({ ok: true, value: crossUnitPlan })
      mocks.listRecipes.mockResolvedValue({
        ok: true,
        value: [
          makeRecipe('recipe-1', 'Salad', [{ name: 'tomaten', quantity: 400, unit: 'g' }]),
          makeRecipe('recipe-2', 'Stew', [{ name: 'tomaten', quantity: 0.5, unit: 'kg' }]),
        ],
      })

      const result = await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: undefined,
      })

      expect(result.polishStatus).toBe('ai_skipped')
      expect(result.baselineLines).toHaveLength(1)
      expect(result.baselineLines[0]).toMatchObject({ name: 'tomaten', quantity: 900, unit: 'g' })
      expect(result.consolidatedLines).toEqual(result.baselineLines)
    })

    it('sorts consolidatedLines by supermarket aisle when AI is skipped', async () => {
      mocks.listRecipes.mockResolvedValue({
        ok: true,
        value: [makeRecipe('recipe-1', 'Mix', [
          { name: 'melk', quantity: 1, unit: 'l' },
          { name: 'tomaten', quantity: 500, unit: 'g' },
        ])],
      })

      const result = await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: undefined,
      })

      expect(result.polishStatus).toBe('ai_skipped')
      expect(result.consolidatedLines.map(l => l.name)).toEqual(['tomaten', 'melk'])
      expect(result.baselineLines.map(l => l.name)).toEqual(['melk', 'tomaten'])
    })
  })

  describe('polish port throws (network/timeout error)', () => {
    it('returns baseline_fallback when polish port throws', async () => {
      const mockPort: ShoppingListPolishPort = {
        polish: vi.fn().mockRejectedValue(new Error('Connection reset')),
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
