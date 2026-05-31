/**
 * Component tests for Deprecated saved consolidated shopping list UX (issue #030).
 * Covers: deprecated banner, read-only list, consolidate path after deprecation.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed } from 'vue'
import { formatShoppingListIngredient } from '../../utils/shoppingList'
import ShoppingListPage from '../../app/pages/shopping-list.vue'

const mountOptions = {
  global: {
    stubs: {
      NuxtLink: {
        name: 'NuxtLink',
        props: ['to'],
        template: '<a :href="JSON.stringify(to)"><slot /></a>',
      },
      'ShoppingListPolishReview': {
        name: 'ShoppingListPolishReview',
        props: ['reviewLines', 'baselineLines', 'hints', 'sections'],
        template: '<div data-testid="polish-review"><slot /></div>',
        emits: ['update-line', 'confirm'],
      },
    },
  },
}

function setupGlobals(query: Record<string, string>, overrides: Partial<{
  loading: boolean
  planName: string
  sections: unknown[]
  planLoaded: boolean
  planError: boolean
  failedRecipeCount: number
}> = {}) {
  const state = {
    loading: ref(overrides.loading ?? false),
    planName: ref(overrides.planName ?? 'Test Plan'),
    sections: ref(overrides.sections ?? [
      { recipeId: 'r1', recipeTitle: 'Pasta', occurrenceCount: 2, ingredients: [{ rawText: '400 g pasta', name: 'pasta', quantity: 400, unit: 'g' }] },
    ]),
    planLoaded: ref(overrides.planLoaded ?? true),
    planError: ref(overrides.planError ?? false),
    failedRecipeCount: ref(overrides.failedRecipeCount ?? 0),
    load: vi.fn(),
  }

  const consolidatedState = {
    consolidating: ref(false),
    consolidatedLines: ref<unknown[]>([]),
    consolidationError: ref<string | null>(null),
    polishStatus: ref<string | null>(null),
    warnings: ref<string[]>([]),
    baselineLines: ref<unknown[]>([]),
    changes: ref<unknown[]>([]),
    hasConsolidated: ref(false),
    consolidate: vi.fn(),
    reset: vi.fn(),
    hints: ref<unknown[]>([]),
    reviewLines: ref<unknown[]>([]),
    updateReviewLine: vi.fn(),
    confirmReview: vi.fn(),
    shoppingListDeprecated: ref(false),
    savedListHydrationSettled: ref(true),
    savedList: ref(null),
    loadSavedList: vi.fn(),
  }

  const routerReplaceMock = vi.fn()

  vi.stubGlobal('useRoute', () => ({ query }))
  vi.stubGlobal('useRouter', () => ({ replace: routerReplaceMock }))
  vi.stubGlobal('useHead', vi.fn())
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('useShoppingList', () => state)
  vi.stubGlobal('useConsolidatedShoppingList', () => consolidatedState)
  vi.stubGlobal('formatShoppingListIngredient', formatShoppingListIngredient)

  return { state, consolidatedState, routerReplaceMock }
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('shopping-list page: deprecated saved consolidated shopping list', () => {
  it('shows recipes-changed notice when shoppingListDeprecated is true', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.shoppingListDeprecated.value = true
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)

    expect(wrapper.find('[data-testid="recipes-changed-notice"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Recipes changed')
  })

  it('does NOT show recipes-changed notice when shoppingListDeprecated is false', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.shoppingListDeprecated.value = false
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)

    expect(wrapper.find('[data-testid="recipes-changed-notice"]').exists()).toBe(false)
  })

  it('deprecated list lines are displayed read-only (no confirm/save button)', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.shoppingListDeprecated.value = true
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
      { id: 'L2', name: 'olijfolie', quantity: 2, unit: 'el', provenance: [] },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)

    // Lines are visible
    expect(wrapper.text()).toContain('pasta')
    expect(wrapper.text()).toContain('olijfolie')

    // No confirm or save button when deprecated
    expect(wrapper.find('[data-testid="confirm-review"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="save-btn"]').exists()).toBe(false)
  })

  it('shows Consolidate action button when deprecated', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.shoppingListDeprecated.value = true
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)

    expect(wrapper.find('[data-testid="consolidate-btn"]').exists()).toBe(true)
  })

  it('Consolidate action after deprecation triggers consolidation', async () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.shoppingListDeprecated.value = true
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)
    await wrapper.find('[data-testid="consolidate-btn"]').trigger('click')

    expect(consolidatedState.consolidate).toHaveBeenCalled()
  })

  it('after consolidation from deprecated state, shows polish review (pending_review)', async () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    // Simulate post-consolidate state: deprecated cleared, polish review shown
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'pending_review'
    consolidatedState.shoppingListDeprecated.value = false
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'tomaten', quantity: 600, unit: 'g', provenance: [] },
    ]
    consolidatedState.reviewLines.value = [
      { id: 'L1', name: 'tomaten', quantity: 600, unit: 'g', provenance: [] },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)

    expect(wrapper.find('[data-testid="polish-review"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="recipes-changed-notice"]').exists()).toBe(false)
  })

  it('recipes-changed notice is not shown in recipe sections view', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1' }) // no view=consolidated
    consolidatedState.hasConsolidated.value = true
    consolidatedState.shoppingListDeprecated.value = true

    const wrapper = mount(ShoppingListPage, mountOptions)

    expect(wrapper.find('[data-testid="recipes-changed-notice"]').exists()).toBe(false)
  })
})
