/**
 * Regression: approved saved consolidated list is loaded on return navigation.
 * Since cutover, sections view is the default; no auto-switch to consolidated.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed, watch, reactive, nextTick, type Ref } from 'vue'
import { formatShoppingListIngredient, formatMergedLine } from '../../utils/shoppingList'
import ShoppingListPage from '../../app/pages/shopping-list.vue'
import { useConsolidatedShoppingList, _sessionDraftStore } from '../../app/composables/useConsolidatedShoppingList'
import { useNetworkFeatureState } from '../../app/composables/useNetworkFeatureState'
import type { SavedConsolidatedShoppingListRecord } from '../../server/services/shopping-list/consolidatedShoppingListRepository'

const mountOptions = {
  global: {
    stubs: {
      NuxtLink: {
        name: 'NuxtLink',
        props: ['to'],
        template: '<a :href="JSON.stringify(to)"><slot /></a>',
      },
    },
  },
}

const savedRecord: SavedConsolidatedShoppingListRecord = {
  lines: [
    { id: 'L3', name: 'tomaten', quantity: 400, unit: 'g' },
    { id: 'L1', name: 'melk', quantity: 1, unit: 'l' },
  ],
  sourceFingerprint: 'fp-saved',
  confirmedAt: '2026-05-26T10:00:00.000Z',
}

function setupWithRealConsolidatedComposable(
  initialQuery: Record<string, string>,
  fetchPlanFlagsOverride?: ReturnType<typeof vi.fn>,
  fetchConsolidateOverride?: ReturnType<typeof vi.fn>,
) {
  const routeQuery = reactive<Record<string, string>>({ ...initialQuery })

  const shoppingListState = {
    loading: ref(false),
    planName: ref('Test Plan'),
    sections: ref([
      {
        recipeId: 'r1',
        recipeTitle: 'Pasta',
        occurrenceCount: 1,
        ingredients: [{ rawText: '400 g pasta', name: 'pasta', quantity: 400, unit: 'g' }],
      },
    ]),
    planLoaded: ref(true),
    planError: ref(false),
    failedRecipeCount: ref(0),
    load: vi.fn(),
  }

  const fetchSavedList = vi.fn().mockResolvedValue(savedRecord)
  const fetchPlanFlags = fetchPlanFlagsOverride ?? vi.fn().mockResolvedValue({
    hasSavedShoppingList: true,
    shoppingListDeprecated: false,
  })
  const fetchConsolidate = fetchConsolidateOverride ?? vi.fn().mockResolvedValue({
    status: 'baseline_fallback',
    lines: [],
    warnings: ['AI not available'],
  })

  const routerReplaceMock = vi.fn((opts: { path: string, query: Record<string, string> }) => {
    delete routeQuery.plan
    delete routeQuery.view
    Object.assign(routeQuery, opts.query)
  })

  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('useRoute', () => ({ query: routeQuery, path: '/shopping-list' }))
  vi.stubGlobal('useRouter', () => ({ replace: routerReplaceMock }))
  vi.stubGlobal('useHead', vi.fn())
  vi.stubGlobal('useShoppingList', () => shoppingListState)
  vi.stubGlobal('useConsolidatedShoppingList', (id: Ref<string>) =>
    useConsolidatedShoppingList(id, { fetchSavedList, fetchPlanFlags, fetchConsolidate }),
  )
  vi.stubGlobal('useNetworkFeatureState', () => useNetworkFeatureState())
  vi.stubGlobal('formatShoppingListIngredient', formatShoppingListIngredient)
  vi.stubGlobal('formatMergedLine', formatMergedLine)

  return { routeQuery, routerReplaceMock, fetchSavedList, fetchPlanFlags, fetchConsolidate, shoppingListState }
}

beforeEach(() => {
  vi.unstubAllGlobals()
  _sessionDraftStore.clear()
})

describe('shopping-list page: saved consolidated list on return', () => {
  it('stays on sections view and does not auto-switch even when a saved list exists and no view param is given', async () => {
    const { routerReplaceMock, fetchSavedList } = setupWithRealConsolidatedComposable({ plan: 'plan-1' })

    mount(ShoppingListPage, mountOptions)
    await flushPromises()
    await vi.waitFor(() => expect(fetchSavedList).toHaveBeenCalledWith('plan-1'))

    const consolidatedReplace = routerReplaceMock.mock.calls.some(
      call => call[0]?.query?.view === 'consolidated',
    )
    expect(consolidatedReplace).toBe(false)
  })

  it('respects explicit view=sections and does not auto-switch to consolidated', async () => {
    const { routerReplaceMock, fetchSavedList } = setupWithRealConsolidatedComposable({
      plan: 'plan-1',
      view: 'sections',
    })

    mount(ShoppingListPage, mountOptions)
    await flushPromises()
    await vi.waitFor(() => expect(fetchSavedList).toHaveBeenCalled())

    const consolidatedReplace = routerReplaceMock.mock.calls.some(
      call => call[0]?.query?.view === 'consolidated',
    )
    expect(consolidatedReplace).toBe(false)
  })

  it('does NOT auto-switch to consolidated even when saved list is deprecated', async () => {
    const { routerReplaceMock } = setupWithRealConsolidatedComposable(
      { plan: 'plan-1' },
      vi.fn().mockResolvedValue({
        hasSavedShoppingList: true,
        shoppingListDeprecated: true,
      }),
    )

    mount(ShoppingListPage, mountOptions)
    await flushPromises()
    await nextTick()

    const consolidatedReplace = routerReplaceMock.mock.calls.some(
      call => call[0]?.query?.view === 'consolidated',
    )
    expect(consolidatedReplace).toBe(false)
  })
})
