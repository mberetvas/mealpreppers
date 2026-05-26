/**
 * Unit tests for the consolidation service orchestration (issue #021).
 * Tests the service with stubbed dependencies and polish port.
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

const PLAN_ID = 'plan-123'

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
      '1': { breakfast: { recipeId: 'recipe-1' }, lunch: { recipeId: 'recipe-2' }, dinner: emptySlot },
      '2': { breakfast: { recipeId: 'recipe-1' }, lunch: emptySlot, dinner: emptySlot },
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

describe('consolidateShoppingList service', () => {
  let logger: StructuredLogger

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
  })

  describe('orchestration flow', () => {
    it('loads plan, resolves recipes, merges, and returns baseline when no API key', async () => {
      mocks.getSavedWeekplanById.mockResolvedValue({ ok: true, value: makeSavedWeekplan() })
      mocks.listRecipes.mockResolvedValue({
        ok: true,
        value: [
          makeRecipe('recipe-1', 'Pasta', [{ name: 'pasta', quantity: 400, unit: 'g' }]),
          makeRecipe('recipe-2', 'Salad', [{ name: 'sla', quantity: 1, unit: 'krop' }]),
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
      expect(result.consolidatedLines).toEqual(result.baselineLines)
      // recipe-1 appears twice (day 1 breakfast + day 2 breakfast), so 400*2 = 800g pasta
      const pastaLine = result.baselineLines.find(l => l.name === 'pasta')
      expect(pastaLine?.quantity).toBe(800)
    })

    it('merges same ingredient from multiple recipes', async () => {
      mocks.getSavedWeekplanById.mockResolvedValue({ ok: true, value: makeSavedWeekplan() })
      mocks.listRecipes.mockResolvedValue({
        ok: true,
        value: [
          makeRecipe('recipe-1', 'Pasta', [{ name: 'olijfolie', quantity: 2, unit: 'el' }]),
          makeRecipe('recipe-2', 'Salad', [{ name: 'olijfolie', quantity: 1, unit: 'el' }]),
        ],
      })

      const result = await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: undefined,
      })

      // recipe-1 x 2 occurrences (2*2=4 el) + recipe-2 x 1 (1 el) = 5 el
      const oilLine = result.baselineLines.find(l => l.name === 'olijfolie')
      expect(oilLine?.quantity).toBe(5)
      expect(oilLine?.provenance).toHaveLength(2)
    })
  })

  describe('ai_skipped path', () => {
    beforeEach(() => {
      mocks.getSavedWeekplanById.mockResolvedValue({ ok: true, value: makeSavedWeekplan() })
      mocks.listRecipes.mockResolvedValue({
        ok: true,
        value: [
          makeRecipe('recipe-1', 'Pasta', [{ name: 'pasta', quantity: 400, unit: 'g' }]),
          makeRecipe('recipe-2', 'Salad', [{ name: 'sla', quantity: 1, unit: 'krop' }]),
        ],
      })
    })

    it('returns ai_skipped when openrouterApiKey is undefined', async () => {
      const result = await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: undefined,
      })

      expect(result.polishStatus).toBe('ai_skipped')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('returns ai_skipped when openrouterApiKey is empty string (falsy)', async () => {
      const result = await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: '',
      })

      expect(result.polishStatus).toBe('ai_skipped')
    })

    it('logs consolidate_start and polish_skipped events', async () => {
      await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: undefined,
      })

      expect(logger.info).toHaveBeenCalledWith('shopping_list.consolidate_start', expect.objectContaining({ planId: PLAN_ID }))
      expect(logger.info).toHaveBeenCalledWith('shopping_list.polish_skipped', expect.objectContaining({ reason: 'missing_api_key' }))
      expect(logger.info).toHaveBeenCalledWith('shopping_list.consolidate_complete', expect.objectContaining({
        planId: PLAN_ID,
        polishStatus: 'ai_skipped',
      }))
    })

    it('logs consolidate_complete with latency and line counts', async () => {
      await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: undefined,
      })

      expect(logger.info).toHaveBeenCalledWith('shopping_list.consolidate_complete', expect.objectContaining({
        latencyMs: expect.any(Number),
        baselineLineCount: expect.any(Number),
        consolidatedLineCount: expect.any(Number),
      }))
    })
  })

  describe('polish port with API key set', () => {
    beforeEach(() => {
      mocks.getSavedWeekplanById.mockResolvedValue({ ok: true, value: makeSavedWeekplan() })
      mocks.listRecipes.mockResolvedValue({
        ok: true,
        value: [
          makeRecipe('recipe-1', 'Pasta', [{ name: 'pasta', quantity: 400, unit: 'g' }]),
          makeRecipe('recipe-2', 'Salad', [{ name: 'sla', quantity: 1, unit: 'krop' }]),
        ],
      })
    })

    it('returns ai_skipped when API key is set but polishPort is null', async () => {
      const result = await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: 'sk-test-key',
      })

      expect(result.polishStatus).toBe('ai_skipped')
      expect(result.warnings[0]).toContain('skipped')
    })

    it('invokes polish port and returns polished when port succeeds and harness passes', async () => {
      const mockPort: ShoppingListPolishPort = {
        polish: vi.fn().mockResolvedValue({
          response: {
            lines: [
              { id: 'L1', name: 'Pasta', quantity: 800, unit: 'g' },
              { id: 'L2', name: 'sla', quantity: 1, unit: 'krop' },
            ],
            changes: [{ id: 'L1', reason: 'Capitalized name' }],
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
      expect(result.consolidatedLines[0].name).toBe('Pasta')
      expect(result.changes).toHaveLength(1)
      expect(mockPort.polish).toHaveBeenCalledOnce()
    })

    it('falls back to baseline when polish port throws', async () => {
      const mockPort: ShoppingListPolishPort = {
        polish: vi.fn().mockRejectedValue(new Error('AI call failed')),
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

  describe('partial recipe resolution', () => {
    it('consolidates only loaded sections when some plan recipes are missing from catalog', async () => {
      mocks.getSavedWeekplanById.mockResolvedValue({ ok: true, value: makeSavedWeekplan() })
      // Catalog only has recipe-1, not recipe-2
      mocks.listRecipes.mockResolvedValue({
        ok: true,
        value: [
          makeRecipe('recipe-1', 'Pasta', [{ name: 'pasta', quantity: 400, unit: 'g' }]),
        ],
      })

      const result = await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: undefined,
      })

      // Only pasta from recipe-1 is in baseline (recipe-2 was missing)
      expect(result.baselineLines).toHaveLength(1)
      expect(result.baselineLines[0].name).toBe('pasta')
    })

    it('adds incomplete warning to warnings[] when some recipes are missing', async () => {
      mocks.getSavedWeekplanById.mockResolvedValue({ ok: true, value: makeSavedWeekplan() })
      mocks.listRecipes.mockResolvedValue({
        ok: true,
        value: [
          makeRecipe('recipe-1', 'Pasta', [{ name: 'pasta', quantity: 400, unit: 'g' }]),
        ],
      })

      const result = await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: undefined,
      })

      expect(result.warnings).toContainEqual(
        expect.stringContaining('could not be loaded'),
      )
    })

    it('logs partial resolution with count of missing recipes', async () => {
      mocks.getSavedWeekplanById.mockResolvedValue({ ok: true, value: makeSavedWeekplan() })
      mocks.listRecipes.mockResolvedValue({
        ok: true,
        value: [
          makeRecipe('recipe-1', 'Pasta', [{ name: 'pasta', quantity: 400, unit: 'g' }]),
        ],
      })

      await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: undefined,
      })

      expect(logger.warn).toHaveBeenCalledWith(
        'shopping_list.partial_recipe_resolution',
        expect.objectContaining({ planId: PLAN_ID, missingCount: 1 }),
      )
    })
  })

  describe('total recipe resolution failure', () => {
    it('returns empty consolidation result when all plan recipes are missing from catalog', async () => {
      mocks.getSavedWeekplanById.mockResolvedValue({ ok: true, value: makeSavedWeekplan() })
      // Catalog has no matching recipes
      mocks.listRecipes.mockResolvedValue({
        ok: true,
        value: [
          makeRecipe('recipe-other', 'Other', [{ name: 'other', quantity: 1, unit: 'stuk' }]),
        ],
      })

      const result = await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: undefined,
      })

      expect(result.consolidatedLines).toEqual([])
      expect(result.baselineLines).toEqual([])
    })

    it('adds total failure warning to warnings[] when no recipes could be resolved', async () => {
      mocks.getSavedWeekplanById.mockResolvedValue({ ok: true, value: makeSavedWeekplan() })
      mocks.listRecipes.mockResolvedValue({
        ok: true,
        value: [
          makeRecipe('recipe-other', 'Other', [{ name: 'other', quantity: 1, unit: 'stuk' }]),
        ],
      })

      const result = await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: undefined,
      })

      expect(result.warnings).toContainEqual(
        expect.stringContaining('Could not load any recipes'),
      )
    })

    it('returns ai_skipped polish status on total recipe failure', async () => {
      mocks.getSavedWeekplanById.mockResolvedValue({ ok: true, value: makeSavedWeekplan() })
      mocks.listRecipes.mockResolvedValue({
        ok: true,
        value: [
          makeRecipe('recipe-other', 'Other', [{ name: 'other', quantity: 1, unit: 'stuk' }]),
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
      expect(result.changes).toEqual([])
    })
  })

  describe('empty plan', () => {
    function makeEmptyWeekPlanBody() {
      const emptySlot = { recipeId: null }
      const day = { breakfast: emptySlot, lunch: emptySlot, dinner: emptySlot }
      return {
        version: 'week_v1' as const,
        days: { '1': day, '2': day, '3': day, '4': day, '5': day, '6': day, '7': day },
      }
    }

    it('returns empty consolidated list when plan has no recipes', async () => {
      mocks.getSavedWeekplanById.mockResolvedValue({
        ok: true,
        value: { ...makeSavedWeekplan(), body: makeEmptyWeekPlanBody() },
      })
      mocks.listRecipes.mockResolvedValue({ ok: true, value: [] })

      const result = await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: undefined,
      })

      expect(result.consolidatedLines).toEqual([])
      expect(result.baselineLines).toEqual([])
    })

    it('adds empty plan warning to warnings[]', async () => {
      mocks.getSavedWeekplanById.mockResolvedValue({
        ok: true,
        value: { ...makeSavedWeekplan(), body: makeEmptyWeekPlanBody() },
      })
      mocks.listRecipes.mockResolvedValue({ ok: true, value: [] })

      const result = await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: undefined,
      })

      expect(result.warnings).toContainEqual(
        expect.stringContaining('no recipes'),
      )
    })

    it('returns ai_skipped polish status for empty plan', async () => {
      mocks.getSavedWeekplanById.mockResolvedValue({
        ok: true,
        value: { ...makeSavedWeekplan(), body: makeEmptyWeekPlanBody() },
      })
      mocks.listRecipes.mockResolvedValue({ ok: true, value: [] })

      const result = await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: undefined,
      })

      expect(result.polishStatus).toBe('ai_skipped')
      expect(result.changes).toEqual([])
    })

    it('does not invoke listRecipes when plan has no recipe slots', async () => {
      mocks.getSavedWeekplanById.mockResolvedValue({
        ok: true,
        value: { ...makeSavedWeekplan(), body: makeEmptyWeekPlanBody() },
      })
      mocks.listRecipes.mockResolvedValue({ ok: true, value: [] })

      await consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: undefined,
      })

      expect(mocks.listRecipes).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('throws HTTP error when plan is not found', async () => {
      mocks.getSavedWeekplanById.mockResolvedValue({
        ok: false,
        error: { kind: 'not_found', entity: 'saved_weekplan', message: 'Saved weekplan not found.' },
      })

      await expect(consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: undefined,
      })).rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws HTTP error when plan is forbidden', async () => {
      mocks.getSavedWeekplanById.mockResolvedValue({
        ok: false,
        error: { kind: 'forbidden', entity: 'saved_weekplan', message: 'You do not have access.' },
      })

      await expect(consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: undefined,
      })).rejects.toMatchObject({ statusCode: 403 })
    })

    it('throws 500 when recipes fail to load', async () => {
      mocks.getSavedWeekplanById.mockResolvedValue({ ok: true, value: makeSavedWeekplan() })
      mocks.listRecipes.mockResolvedValue({
        ok: false,
        error: { kind: 'storage_error', message: 'DB error' },
      })

      await expect(consolidateShoppingList(PLAN_ID, {
        supabaseClient: {} as unknown as SupabaseClient,
        principal: makePrincipal(),
        logger,
        polishPort: null,
        openrouterApiKey: undefined,
      })).rejects.toMatchObject({ statusCode: 500 })
    })
  })
})
