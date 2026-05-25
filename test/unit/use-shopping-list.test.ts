import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick, effectScope } from 'vue'
import type { Ref } from 'vue'
import type { WeekPlanV1 } from '../../types/planning'
import type { RecipeCatalogItem } from '../../types/recipe-catalog-item'
import { emptyWeekPlan } from '../../utils/weekPlan'
import { useShoppingList, type UseShoppingListOptions } from '../../app/composables/useShoppingList'

const RID_A = '11111111-1111-1111-1111-111111111111'
const RID_B = '22222222-2222-2222-2222-222222222222'

function makeRecipe(
  id: string,
  title: string,
  ingredients: RecipeCatalogItem['ingredients'] = [],
): RecipeCatalogItem {
  return {
    id,
    title,
    categories: [],
    tags: [],
    ingredients,
    steps: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  }
}

function makePlan(name: string, assignments: Record<string, Record<string, string>>): { id: string; name: string; body: WeekPlanV1 } {
  const body = emptyWeekPlan()
  for (const [day, meals] of Object.entries(assignments)) {
    for (const [meal, recipeId] of Object.entries(meals)) {
      const daySlots = body.days[day] as Record<string, { recipeId: string | null }>
      daySlots[meal].recipeId = recipeId
    }
  }
  return { id: 'plan-1', name, body }
}

/** Creates a deferred promise that can be resolved/rejected externally. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Drains all pending microtasks (resolved promises). */
function flushPromises(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe('useShoppingList composable', () => {
  let scope: ReturnType<typeof effectScope>

  beforeEach(() => {
    scope = effectScope()
  })

  function setup(planId: Ref<string>, options: UseShoppingListOptions = {}) {
    let result!: ReturnType<typeof useShoppingList>
    scope.run(() => {
      result = useShoppingList(planId, options)
    })
    return result
  }

  describe('plan loaded successfully', () => {
    it('sets planName, sections, planLoaded on success', async () => {
      const plan = makePlan('Autumn Week', { '1': { breakfast: RID_A } })
      const recipe = makeRecipe(RID_A, 'Pasta', [
        { id: 'i1', position: 1, rawText: '200g pasta', name: 'pasta', quantity: 200, unit: 'g' },
      ])
      const planId = ref('plan-1')
      const { planName, sections, planLoaded, planError, loading } = setup(planId, {
        fetchPlan: vi.fn().mockResolvedValue(plan),
        fetchRecipe: vi.fn().mockResolvedValue(recipe),
      })

      await flushPromises()

      expect(loading.value).toBe(false)
      expect(planLoaded.value).toBe(true)
      expect(planError.value).toBe(false)
      expect(planName.value).toBe('Autumn Week')
      expect(sections.value).toHaveLength(1)
      expect(sections.value[0].recipeTitle).toBe('Pasta')
    })

    it('sets loading to true while fetching', async () => {
      const d = deferred<{ id: string; name: string; body: WeekPlanV1 }>()
      const planId = ref('plan-1')
      const { loading } = setup(planId, {
        fetchPlan: () => d.promise,
        fetchRecipe: vi.fn(),
      })

      expect(loading.value).toBe(true)

      d.resolve(makePlan('Week', {}))
      await flushPromises()

      expect(loading.value).toBe(false)
    })

    it('sets planError when planId is empty', async () => {
      const planId = ref('')
      const { planError, loading, planLoaded } = setup(planId, {
        fetchPlan: vi.fn(),
        fetchRecipe: vi.fn(),
      })

      await flushPromises()

      expect(planError.value).toBe(true)
      expect(loading.value).toBe(false)
      expect(planLoaded.value).toBe(false)
    })
  })

  describe('plan-link change mid-load (race guard)', () => {
    it('discards first result when second load resolves before the first', async () => {
      const deferredA = deferred<{ id: string; name: string; body: WeekPlanV1 }>()
      const deferredB = deferred<{ id: string; name: string; body: WeekPlanV1 }>()

      const planId = ref('plan-A')
      const fetchPlan = vi.fn()
        .mockReturnValueOnce(deferredA.promise)
        .mockReturnValueOnce(deferredB.promise)

      const recipeB = makeRecipe(RID_B, 'Salad', [
        { id: 'i1', position: 1, rawText: '100g lettuce', name: 'lettuce', quantity: 100, unit: 'g' },
      ])
      const fetchRecipe = vi.fn().mockResolvedValue(recipeB)

      const { planName, sections, planLoaded } = setup(planId, { fetchPlan, fetchRecipe })

      // First load is in flight (plan-A)
      await flushPromises()
      expect(planLoaded.value).toBe(false)

      // Plan link changes → triggers second load (plan-B)
      planId.value = 'plan-B'
      await nextTick()
      await flushPromises()

      // Resolve plan-B first (fast response)
      const planB = makePlan('Plan B', { '2': { lunch: RID_B } })
      deferredB.resolve(planB)
      await flushPromises()

      expect(planName.value).toBe('Plan B')
      expect(sections.value).toHaveLength(1)
      expect(planLoaded.value).toBe(true)

      // Now resolve plan-A (stale, arrived late)
      const planA = makePlan('Plan A', { '1': { breakfast: RID_A } })
      deferredA.resolve(planA)
      await flushPromises()

      // Stale result must NOT overwrite the current state
      expect(planName.value).toBe('Plan B')
      expect(sections.value).toHaveLength(1)
      expect(sections.value[0].recipeTitle).toBe('Salad')
    })

    it('discards first error when second load already resolved', async () => {
      const deferredA = deferred<{ id: string; name: string; body: WeekPlanV1 }>()
      const deferredB = deferred<{ id: string; name: string; body: WeekPlanV1 }>()

      const planId = ref('plan-A')
      const fetchPlan = vi.fn()
        .mockReturnValueOnce(deferredA.promise)
        .mockReturnValueOnce(deferredB.promise)
      const fetchRecipe = vi.fn().mockResolvedValue(makeRecipe(RID_A, 'R'))

      const { planError, planLoaded } = setup(planId, { fetchPlan, fetchRecipe })

      await flushPromises()

      // Plan link changes → second load
      planId.value = 'plan-B'
      await nextTick()
      await flushPromises()

      // Resolve plan-B successfully
      deferredB.resolve(makePlan('Plan B', {}))
      await flushPromises()
      expect(planLoaded.value).toBe(true)
      expect(planError.value).toBe(false)

      // plan-A fails late — must NOT set planError
      deferredA.reject(new Error('timeout'))
      await flushPromises()

      expect(planError.value).toBe(false)
      expect(planLoaded.value).toBe(true)
    })
  })

  describe('total recipe-resolution failure', () => {
    it('sets failedRecipeCount equal to total recipes and empty sections when all fetches fail', async () => {
      const plan = makePlan('Week', { '1': { breakfast: RID_A }, '2': { lunch: RID_B } })
      const planId = ref('plan-1')
      const { sections, failedRecipeCount, planLoaded } = setup(planId, {
        fetchPlan: vi.fn().mockResolvedValue(plan),
        fetchRecipe: vi.fn().mockRejectedValue(new Error('not found')),
      })

      await flushPromises()

      expect(planLoaded.value).toBe(true)
      expect(failedRecipeCount.value).toBe(2)
      expect(sections.value).toHaveLength(0)
    })
  })

  describe('partial recipe-resolution failure', () => {
    it('loads successful recipes and reports the failure count', async () => {
      const plan = makePlan('Week', { '1': { breakfast: RID_A, lunch: RID_B } })
      const planId = ref('plan-1')
      const { sections, failedRecipeCount, planLoaded } = setup(planId, {
        fetchPlan: vi.fn().mockResolvedValue(plan),
        fetchRecipe: vi.fn().mockImplementation((id: string) => {
          if (id === RID_B) return Promise.reject(new Error('not found'))
          return Promise.resolve(makeRecipe(id, 'Recipe A', [
            { id: 'i1', position: 1, rawText: '100g rice', name: 'rice', quantity: 100, unit: 'g' },
          ]))
        }),
      })

      await flushPromises()

      expect(planLoaded.value).toBe(true)
      expect(failedRecipeCount.value).toBe(1)
      expect(sections.value).toHaveLength(1)
      expect(sections.value[0].recipeId).toBe(RID_A)
    })
  })
})
