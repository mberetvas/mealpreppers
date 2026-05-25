import { ref, watch, type Ref } from 'vue'
import type { WeekPlanV1 } from '~~/types/planning'
import type { RecipeCatalogItem } from '~~/types/recipe-catalog-item'
import {
  collectRecipeOccurrences,
  buildShoppingList,
  type ShoppingListSection,
} from '~~/utils/shoppingList'

export interface UseShoppingListOptions {
  fetchPlan?: (id: string) => Promise<{ id: string; name: string; body: WeekPlanV1 }>
  fetchRecipe?: (id: string) => Promise<RecipeCatalogItem>
}

/**
 * Owns all fetch, build, and state management for the Shopping list page.
 * Includes a load-generation token that discards stale responses when the
 * planId changes before a previous load completes.
 */
export function useShoppingList(planId: Ref<string>, options: UseShoppingListOptions = {}) {
  const {
    fetchPlan = (id: string) => $fetch(`/api/v1/saved-weekplans/${id}`),
    fetchRecipe = (id: string) => $fetch(`/api/v1/recipes/${id}`),
  } = options

  const loading = ref(true)
  const planName = ref('')
  const sections = ref<ShoppingListSection[]>([])
  const planLoaded = ref(false)
  const planError = ref(false)
  const failedRecipeCount = ref(0)

  let loadGeneration = 0

  /** Fetches the weekplan, fans out to all recipe endpoints, and builds the shopping list. */
  async function load(): Promise<void> {
    const generation = ++loadGeneration
    loading.value = true
    planError.value = false
    failedRecipeCount.value = 0
    planLoaded.value = false
    sections.value = []
    planName.value = ''
    if (!planId.value) {
      planError.value = true
      loading.value = false
      return
    }

    try {
      const plan = await fetchPlan(planId.value)
      if (generation !== loadGeneration) return

      planName.value = plan.name
      const occurrences = collectRecipeOccurrences(plan.body)
      const recipeIds = [...occurrences.keys()]

      const settled = await Promise.allSettled(
        recipeIds.map(id => fetchRecipe(id)),
      )
      if (generation !== loadGeneration) return

      const recipeMap = new Map<string, RecipeCatalogItem>()
      let failures = 0
      for (const [index, recipeId] of recipeIds.entries()) {
        const result = settled[index]
        if (result && result.status === 'fulfilled') {
          recipeMap.set(recipeId, result.value)
        }
        else {
          failures++
        }
      }

      failedRecipeCount.value = failures
      sections.value = buildShoppingList(occurrences, recipeMap)
      planLoaded.value = true
    }
    catch {
      if (generation !== loadGeneration) return
      planError.value = true
    }
    finally {
      if (generation === loadGeneration) {
        loading.value = false
      }
    }
  }

  watch(planId, load, { immediate: true })

  return { loading, planName, sections, planLoaded, planError, failedRecipeCount, load }
}
