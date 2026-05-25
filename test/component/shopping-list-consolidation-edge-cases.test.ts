/**
 * Component tests for shopping list consolidation edge cases (issue #025):
 * - Partial recipe resolution: warning visible in consolidated view
 * - Empty plan: consolidate action unavailable, add-recipes guidance shown
 * - Total recipe resolution failure: consolidate action unavailable, warning banner
 * - Consolidation API warnings[] visible in consolidated view
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

describe('shopping-list page: partial recipe resolution in consolidated view', () => {
  it('shows incomplete warning banner in consolidated view when failedRecipeCount > 0', () => {
    setupGlobals({ plan: 'plan-1', view: 'consolidated' }, {
      planLoaded: true,
      sections: [{ recipeId: 'r1', recipeTitle: 'Pasta', occurrenceCount: 1, ingredients: [{ rawText: '400 g pasta', name: 'pasta', quantity: 400, unit: 'g' }] }],
      failedRecipeCount: 2,
    })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).toContain('could not be loaded')
    expect(wrapper.text()).toContain('may be incomplete')
  })

  it('displays consolidation API warnings in consolidated view after partial consolidation', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' }, {
      planLoaded: true,
      sections: [{ recipeId: 'r1', recipeTitle: 'Pasta', occurrenceCount: 1, ingredients: [{ rawText: '400 g pasta', name: 'pasta', quantity: 400, unit: 'g' }] }],
      failedRecipeCount: 1,
    })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'ai_skipped'
    consolidatedState.baselineLines.value = [
      { id: 'L1', name: 'pasta', quantity: 400, unit: 'g', provenance: [] },
    ]
    consolidatedState.warnings.value = [
      '1 recipe(s) could not be loaded — this list may be incomplete.',
      'AI polish was skipped because the API key is not configured.',
    ]
    const wrapper = mount(ShoppingListPage, mountOptions)
    // The ai-skipped banner shows warnings[0] content
    expect(wrapper.find('[data-testid="ai-skipped-banner"]').exists()).toBe(true)
    // Partial resolution warning is also visible (from the page-level failedRecipeCount banner)
    expect(wrapper.text()).toContain('may be incomplete')
  })

  it('consolidate action remains available during partial resolution', () => {
    setupGlobals({ plan: 'plan-1', view: 'consolidated' }, {
      planLoaded: true,
      sections: [{ recipeId: 'r1', recipeTitle: 'Pasta', occurrenceCount: 1, ingredients: [] }],
      failedRecipeCount: 1,
    })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="consolidate-btn"]').exists()).toBe(true)
  })

  it('view mode toggle is visible during partial resolution', () => {
    setupGlobals({ plan: 'plan-1', view: 'consolidated' }, {
      planLoaded: true,
      sections: [{ recipeId: 'r1', recipeTitle: 'Pasta', occurrenceCount: 1, ingredients: [] }],
      failedRecipeCount: 1,
    })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="view-mode-toggle"]').exists()).toBe(true)
  })
})

describe('shopping-list page: empty plan — consolidated view unavailable', () => {
  it('does not show view mode toggle when plan has no recipes', () => {
    setupGlobals({ plan: 'plan-1', view: 'consolidated' }, {
      planLoaded: true,
      sections: [],
      failedRecipeCount: 0,
    })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="view-mode-toggle"]').exists()).toBe(false)
  })

  it('shows add-recipes guidance when plan is empty', () => {
    setupGlobals({ plan: 'plan-1', view: 'consolidated' }, {
      planLoaded: true,
      sections: [],
      failedRecipeCount: 0,
    })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).toContain('no recipes yet')
    expect(wrapper.text()).toContain('Add recipes')
  })

  it('consolidate button is not rendered for empty plan', () => {
    setupGlobals({ plan: 'plan-1', view: 'consolidated' }, {
      planLoaded: true,
      sections: [],
      failedRecipeCount: 0,
    })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="consolidate-btn"]').exists()).toBe(false)
  })

  it('provides link to planner for empty plan', () => {
    setupGlobals({ plan: 'plan-1', view: 'consolidated' }, {
      planLoaded: true,
      sections: [],
      failedRecipeCount: 0,
    })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).toContain('Open in Planner')
  })
})

describe('shopping-list page: total recipe resolution failure — consolidate unavailable', () => {
  it('does not show view mode toggle on total recipe failure', () => {
    setupGlobals({ plan: 'plan-1', view: 'consolidated' }, {
      planLoaded: true,
      sections: [],
      failedRecipeCount: 3,
    })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="view-mode-toggle"]').exists()).toBe(false)
  })

  it('consolidate button is not rendered on total recipe failure', () => {
    setupGlobals({ plan: 'plan-1', view: 'consolidated' }, {
      planLoaded: true,
      sections: [],
      failedRecipeCount: 3,
    })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="consolidate-btn"]').exists()).toBe(false)
  })

  it('shows total failure warning banner matching recipe sections state', () => {
    setupGlobals({ plan: 'plan-1', view: 'consolidated' }, {
      planLoaded: true,
      sections: [],
      failedRecipeCount: 3,
    })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).toContain('Could not load any recipes for this plan')
  })

  it('does not show partial failure wording on total failure', () => {
    setupGlobals({ plan: 'plan-1', view: 'consolidated' }, {
      planLoaded: true,
      sections: [],
      failedRecipeCount: 3,
    })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).not.toContain('may be incomplete')
  })

  it('shows direction to open planner on total failure', () => {
    setupGlobals({ plan: 'plan-1', view: 'consolidated' }, {
      planLoaded: true,
      sections: [],
      failedRecipeCount: 3,
    })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).toContain('Open in Planner')
  })
})

describe('shopping-list page: access errors — no regression', () => {
  it('plan not found shows access failure section regardless of view param', () => {
    setupGlobals({ plan: 'plan-1', view: 'consolidated' }, {
      planError: true,
      planLoaded: false,
    })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).toContain('Plan could not be loaded')
    expect(wrapper.find('[data-testid="view-mode-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="consolidate-btn"]').exists()).toBe(false)
  })

  it('no plan selected shows missing plan section regardless of view param', () => {
    setupGlobals({ view: 'consolidated' }, {
      planError: true,
      planLoaded: false,
    })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).toContain('No plan selected')
    expect(wrapper.find('[data-testid="view-mode-toggle"]').exists()).toBe(false)
  })
})
