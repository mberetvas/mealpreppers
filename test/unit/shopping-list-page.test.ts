import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi } from 'vitest'
import type { WeekPlanV1 } from '../../types/planning'
import type { RecipeCatalogItem } from '../../types/recipe-catalog-item'
import type { ShoppingListSection } from '../../utils/shoppingList'
import { collectRecipeOccurrences, buildShoppingList } from '../../utils/shoppingList'
import { emptyWeekPlan } from '../../utils/weekPlan'

/**
 * Mirrors the orchestration logic from app/pages/shopping-list.vue.
 * Kept in sync with the page implementation to verify the fetch-and-build pipeline.
 *
 * Throws when planId is empty or the plan fetch fails.
 * Returns failedRecipeCount so callers can render a partial-load warning.
 */
async function loadShoppingList(
  planId: string,
  fetchPlan: (id: string) => Promise<{ name: string; body: WeekPlanV1 }>,
  fetchRecipe: (id: string) => Promise<RecipeCatalogItem>,
): Promise<{ planName: string; sections: ShoppingListSection[]; failedRecipeCount: number }> {
  if (!planId) throw new Error('Missing plan ID')
  const plan = await fetchPlan(planId)
  const occurrences = collectRecipeOccurrences(plan.body)
  const recipeIds = [...occurrences.keys()]
  const settled = await Promise.allSettled(recipeIds.map(id => fetchRecipe(id)))
  const recipeMap = new Map<string, RecipeCatalogItem>()
  let failedRecipeCount = 0
  for (let i = 0; i < recipeIds.length; i++) {
    const result = settled[i]
    if (result.status === 'fulfilled') {
      recipeMap.set(recipeIds[i], result.value)
    }
    else {
      failedRecipeCount++
    }
  }
  return { planName: plan.name, sections: buildShoppingList(occurrences, recipeMap), failedRecipeCount }
}

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

describe('shopping-list page: loadShoppingList orchestration', () => {
  it('returns the plan name from the fetched weekplan', async () => {
    const body = emptyWeekPlan()
    body.days['1'].breakfast.recipeId = RID_A
    const fetchPlan = vi.fn().mockResolvedValue({ name: 'Autumn Week', body })
    const fetchRecipe = vi.fn().mockResolvedValue(makeRecipe(RID_A, 'Pasta'))

    const { planName } = await loadShoppingList('plan-1', fetchPlan, fetchRecipe)

    expect(planName).toBe('Autumn Week')
    expect(fetchPlan).toHaveBeenCalledWith('plan-1')
  })

  it('renders recipe sections with correct ingredient lines', async () => {
    const body = emptyWeekPlan()
    body.days['1'].lunch.recipeId = RID_A
    const recipe = makeRecipe(RID_A, 'Pasta', [
      { id: 'i1', position: 1, rawText: '200g pasta', name: 'pasta', quantity: 200, unit: 'g' },
    ])
    const fetchPlan = vi.fn().mockResolvedValue({ name: 'Week 1', body })
    const fetchRecipe = vi.fn().mockResolvedValue(recipe)

    const { sections } = await loadShoppingList('plan-1', fetchPlan, fetchRecipe)

    expect(sections).toHaveLength(1)
    expect(sections[0].recipeTitle).toBe('Pasta')
    expect(sections[0].ingredients[0].name).toBe('pasta')
    expect(sections[0].ingredients[0].quantity).toBe(200)
    expect(sections[0].ingredients[0].unit).toBe('g')
  })

  it('multiplies quantities by occurrenceCount (e.g. recipe used twice → 2× quantities)', async () => {
    const body = emptyWeekPlan()
    body.days['1'].breakfast.recipeId = RID_A
    body.days['3'].lunch.recipeId = RID_A
    const recipe = makeRecipe(RID_A, 'Pasta', [
      { id: 'i1', position: 1, rawText: '200g pasta', name: 'pasta', quantity: 200, unit: 'g' },
    ])
    const fetchPlan = vi.fn().mockResolvedValue({ name: 'Week', body })
    const fetchRecipe = vi.fn().mockResolvedValue(recipe)

    const { sections } = await loadShoppingList('plan-1', fetchPlan, fetchRecipe)

    expect(sections[0].occurrenceCount).toBe(2)
    expect(sections[0].ingredients[0].quantity).toBe(400)
  })

  it('keeps quantity undefined and preserves rawText for ingredients without a quantity', async () => {
    const body = emptyWeekPlan()
    body.days['2'].dinner.recipeId = RID_A
    const recipe = makeRecipe(RID_A, 'Salad', [
      { id: 'i1', position: 1, rawText: 'a pinch of salt', name: 'salt', quantity: undefined, unit: undefined },
    ])
    const fetchPlan = vi.fn().mockResolvedValue({ name: 'Week', body })
    const fetchRecipe = vi.fn().mockResolvedValue(recipe)

    const { sections } = await loadShoppingList('plan-1', fetchPlan, fetchRecipe)

    expect(sections[0].ingredients[0].quantity).toBeUndefined()
    expect(sections[0].ingredients[0].rawText).toBe('a pinch of salt')
  })

  it('sets occurrenceCount to 1 when a recipe appears in a single slot', async () => {
    const body = emptyWeekPlan()
    body.days['1'].breakfast.recipeId = RID_A
    const fetchPlan = vi.fn().mockResolvedValue({ name: 'Week', body })
    const fetchRecipe = vi.fn().mockResolvedValue(makeRecipe(RID_A, 'Eggs'))

    const { sections } = await loadShoppingList('plan-1', fetchPlan, fetchRecipe)

    expect(sections[0].occurrenceCount).toBe(1)
  })

  it('silently skips null meal slots and does not fetch their recipes', async () => {
    const body = emptyWeekPlan()
    body.days['5'].dinner.recipeId = RID_A
    const fetchPlan = vi.fn().mockResolvedValue({ name: 'Week', body })
    const fetchRecipe = vi.fn().mockResolvedValue(makeRecipe(RID_A, 'Soup'))

    const { sections } = await loadShoppingList('plan-1', fetchPlan, fetchRecipe)

    expect(sections).toHaveLength(1)
    expect(fetchRecipe).toHaveBeenCalledTimes(1)
  })

  it('returns empty sections when the weekplan has no assigned recipe slots', async () => {
    const body = emptyWeekPlan()
    const fetchPlan = vi.fn().mockResolvedValue({ name: 'Empty Week', body })
    const fetchRecipe = vi.fn()

    const { sections } = await loadShoppingList('plan-1', fetchPlan, fetchRecipe)

    expect(sections).toHaveLength(0)
    expect(fetchRecipe).not.toHaveBeenCalled()
  })

  it('places sections in first-appearance order (day ascending, breakfast→lunch→dinner)', async () => {
    const body = emptyWeekPlan()
    body.days['3'].dinner.recipeId = RID_B
    body.days['1'].lunch.recipeId = RID_A
    const fetchPlan = vi.fn().mockResolvedValue({ name: 'Week', body })
    const fetchRecipe = vi.fn().mockImplementation((id: string) =>
      Promise.resolve(makeRecipe(id, id === RID_A ? 'Recipe A' : 'Recipe B')),
    )

    const { sections } = await loadShoppingList('plan-1', fetchPlan, fetchRecipe)

    expect(sections[0].recipeId).toBe(RID_A)
    expect(sections[1].recipeId).toBe(RID_B)
  })

  it('omits a recipe section when the recipe fetch fails (allSettled resilience)', async () => {
    const body = emptyWeekPlan()
    body.days['1'].breakfast.recipeId = RID_A
    body.days['1'].lunch.recipeId = RID_B
    const fetchPlan = vi.fn().mockResolvedValue({ name: 'Week', body })
    const fetchRecipe = vi.fn().mockImplementation((id: string) => {
      if (id === RID_B) return Promise.reject(new Error('not found'))
      return Promise.resolve(makeRecipe(id, 'Recipe A'))
    })

    const { sections } = await loadShoppingList('plan-1', fetchPlan, fetchRecipe)

    expect(sections).toHaveLength(1)
    expect(sections[0].recipeId).toBe(RID_A)
  })

  it('fetches each unique recipe id exactly once even with multiple occurrences', async () => {
    const body = emptyWeekPlan()
    body.days['1'].breakfast.recipeId = RID_A
    body.days['2'].lunch.recipeId = RID_A
    body.days['3'].dinner.recipeId = RID_A
    const fetchPlan = vi.fn().mockResolvedValue({ name: 'Week', body })
    const fetchRecipe = vi.fn().mockResolvedValue(makeRecipe(RID_A, 'Recipe A', [
      { id: 'i1', position: 1, rawText: '100g rice', name: 'rice', quantity: 100, unit: 'g' },
    ]))

    const { sections } = await loadShoppingList('plan-1', fetchPlan, fetchRecipe)

    expect(fetchRecipe).toHaveBeenCalledTimes(1)
    expect(sections[0].occurrenceCount).toBe(3)
    expect(sections[0].ingredients[0].quantity).toBe(300)
  })
})

describe('shopping-list page: resilience states', () => {
  it('throws when planId is empty and does not call fetchPlan', async () => {
    const fetchPlan = vi.fn()
    const fetchRecipe = vi.fn()

    await expect(loadShoppingList('', fetchPlan, fetchRecipe)).rejects.toThrow()
    expect(fetchPlan).not.toHaveBeenCalled()
  })

  it('propagates the error when the plan fetch fails', async () => {
    const fetchPlan = vi.fn().mockRejectedValue(new Error('403 Forbidden'))
    const fetchRecipe = vi.fn()

    await expect(loadShoppingList('plan-1', fetchPlan, fetchRecipe)).rejects.toThrow('403 Forbidden')
    expect(fetchRecipe).not.toHaveBeenCalled()
  })

  it('returns failedRecipeCount = 0 when all recipe fetches succeed', async () => {
    const body = emptyWeekPlan()
    body.days['1'].breakfast.recipeId = RID_A
    const fetchPlan = vi.fn().mockResolvedValue({ name: 'Week', body })
    const fetchRecipe = vi.fn().mockResolvedValue(makeRecipe(RID_A, 'Pasta'))

    const { failedRecipeCount } = await loadShoppingList('plan-1', fetchPlan, fetchRecipe)

    expect(failedRecipeCount).toBe(0)
  })

  it('returns failedRecipeCount = 1 when one of two recipe fetches fails', async () => {
    const body = emptyWeekPlan()
    body.days['1'].breakfast.recipeId = RID_A
    body.days['1'].lunch.recipeId = RID_B
    const fetchPlan = vi.fn().mockResolvedValue({ name: 'Week', body })
    const fetchRecipe = vi.fn().mockImplementation((id: string) => {
      if (id === RID_B) return Promise.reject(new Error('not found'))
      return Promise.resolve(makeRecipe(id, 'Recipe A'))
    })

    const { failedRecipeCount, sections } = await loadShoppingList('plan-1', fetchPlan, fetchRecipe)

    expect(failedRecipeCount).toBe(1)
    expect(sections).toHaveLength(1)
    expect(sections[0].recipeId).toBe(RID_A)
  })

  it('returns failedRecipeCount equal to total recipes and empty sections when all fetches fail', async () => {
    const body = emptyWeekPlan()
    body.days['1'].breakfast.recipeId = RID_A
    body.days['1'].lunch.recipeId = RID_B
    const fetchPlan = vi.fn().mockResolvedValue({ name: 'Week', body })
    const fetchRecipe = vi.fn().mockRejectedValue(new Error('not found'))

    const { failedRecipeCount, sections } = await loadShoppingList('plan-1', fetchPlan, fetchRecipe)

    expect(failedRecipeCount).toBe(2)
    expect(sections).toHaveLength(0)
  })

  it('returns failedRecipeCount = 0 when the plan has no assigned recipes', async () => {
    const body = emptyWeekPlan()
    const fetchPlan = vi.fn().mockResolvedValue({ name: 'Empty Week', body })
    const fetchRecipe = vi.fn()

    const { failedRecipeCount } = await loadShoppingList('plan-1', fetchPlan, fetchRecipe)

    expect(failedRecipeCount).toBe(0)
  })
})

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const pageSource = readFileSync(
  join(repoRoot, 'app', 'pages', 'shopping-list.vue'),
  'utf8',
)

describe('shopping-list page: plan link change (issue 006)', () => {
  it('reloads when the Shopping list plan link changes, not only on mount', () => {
    expect(pageSource).toMatch(/watch\s*\(\s*planId\s*,\s*load\s*\)/)
    expect(pageSource).toContain('onMounted(load)')
  })

  it('clears recipe sections at the start of each load', () => {
    expect(pageSource).toContain('sections.value = []')
  })
})

describe('shopping-list page: total recipe resolution failure UI (issue 007)', () => {
  it('renders total-failure when plan loaded, no sections, and failedRecipeCount > 0', () => {
    expect(pageSource).toContain(
      'v-else-if="planLoaded && sections.length === 0 && failedRecipeCount > 0"',
    )
  })

  it('shows total-failure heading and body copy', () => {
    expect(pageSource).toContain('Could not load recipes for this plan')
    expect(pageSource).toContain(
      'Some recipes could not be loaded from the catalog. Try Refresh or open the plan in the planner.',
    )
  })

  it('includes Open in Planner with the current plan id and no duplicate Refresh button in the block', () => {
    const totalFailureIdx = pageSource.indexOf('Could not load recipes for this plan')
    expect(totalFailureIdx).toBeGreaterThan(-1)
    const block = pageSource.slice(totalFailureIdx, totalFailureIdx + 800)
    expect(block).toMatch(/weekly-plan.*template:\s*planId|query:\s*\{\s*template:\s*planId/)
    expect(block).toContain('Open in Planner')
    expect(block).not.toContain('aria-label="Refresh shopping list"')
    expect(block).not.toMatch(/>\s*refresh\s*</i)
  })

  it('keeps empty-plan copy separate from total-failure conditions', () => {
    expect(pageSource).toContain(
      'v-else-if="planLoaded && sections.length === 0 && failedRecipeCount === 0"',
    )
    expect(pageSource).toContain('This plan has no recipes yet')
    const totalFailureBranch = pageSource.match(
      /v-else-if="planLoaded && sections\.length === 0 && failedRecipeCount > 0"[\s\S]*?<\/template>/,
    )?.[0]
    expect(totalFailureBranch).toBeDefined()
    expect(totalFailureBranch).not.toContain('This plan has no recipes yet')
  })
})
