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

describe('shopping-list page: view mode toggle', () => {
  it('renders view mode toggle with Recipe sections and Consolidated options', () => {
    setupGlobals({ plan: 'plan-1' })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).toContain('Recipe sections')
    expect(wrapper.text()).toContain('Consolidated')
  })

  it('defaults to Recipe sections view when no view query param', () => {
    setupGlobals({ plan: 'plan-1' })
    const wrapper = mount(ShoppingListPage, mountOptions)
    const recipeSectionsBtn = wrapper.find('[data-testid="view-mode-sections"]')
    expect(recipeSectionsBtn.classes()).toContain('active')
  })

  it('activates consolidated view when view=consolidated query param present', () => {
    setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    const wrapper = mount(ShoppingListPage, mountOptions)
    const consolidatedBtn = wrapper.find('[data-testid="view-mode-consolidated"]')
    expect(consolidatedBtn.classes()).toContain('active')
  })

  it('switches to consolidated view on toggle click', async () => {
    const { routerReplaceMock } = setupGlobals({ plan: 'plan-1' })
    const wrapper = mount(ShoppingListPage, mountOptions)
    await wrapper.find('[data-testid="view-mode-consolidated"]').trigger('click')
    expect(routerReplaceMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ view: 'consolidated' }) }),
    )
  })

  it('switches back to recipe sections on toggle click', async () => {
    const { routerReplaceMock } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    const wrapper = mount(ShoppingListPage, mountOptions)
    await wrapper.find('[data-testid="view-mode-sections"]').trigger('click')
    expect(routerReplaceMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.not.objectContaining({ view: 'consolidated' }) }),
    )
  })

  it('does not show toggle when plan is not loaded', () => {
    setupGlobals({ plan: 'plan-1' }, { planLoaded: false, loading: true })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="view-mode-toggle"]').exists()).toBe(false)
  })
})

describe('shopping-list page: URL sync', () => {
  it('URL reflects view=consolidated when in consolidated mode', () => {
    setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    const wrapper = mount(ShoppingListPage, mountOptions)
    const consolidatedBtn = wrapper.find('[data-testid="view-mode-consolidated"]')
    expect(consolidatedBtn.classes()).toContain('active')
  })

  it('refresh on view=consolidated URL restores consolidated view without auto-calling API', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    mount(ShoppingListPage, mountOptions)
    expect(consolidatedState.consolidate).not.toHaveBeenCalled()
  })
})

describe('shopping-list page: consolidated view — guidance text', () => {
  it('shows guidance text when consolidated view has no results yet', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = false
    consolidatedState.consolidatedLines.value = []
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).toContain('consolidat')
  })
})

describe('shopping-list page: consolidate action', () => {
  it('shows consolidate button in consolidated view', () => {
    setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="consolidate-btn"]').exists()).toBe(true)
  })

  it('consolidate button triggers API call', async () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    const wrapper = mount(ShoppingListPage, mountOptions)
    await wrapper.find('[data-testid="consolidate-btn"]').trigger('click')
    expect(consolidatedState.consolidate).toHaveBeenCalled()
  })

  it('shows loading indicator during consolidation request', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.consolidating.value = true
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="consolidation-loading"]').exists()).toBe(true)
  })

  it('renders consolidatedLines on successful consolidation', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
      { id: 'L2', name: 'olijfolie', quantity: 2, unit: 'el', provenance: [] },
    ]
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).toContain('pasta')
    expect(wrapper.text()).toContain('olijfolie')
  })
})

describe('shopping-list page: consolidated view — error and fallback states', () => {
  it('shows fallback banner with baseline lines on baseline_fallback', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'baseline_fallback'
    consolidatedState.baselineLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]
    consolidatedState.warnings.value = ['AI polish output rejected by harness validation; returning baseline.']
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="fallback-banner"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('pasta')
  })

  it('shows warning on ai_skipped with baseline lines', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'ai_skipped'
    consolidatedState.baselineLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]
    consolidatedState.warnings.value = ['AI polish was skipped because the API key is not configured.']
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="ai-skipped-banner"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('pasta')
  })

  it('shows error message with retry option on API error', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.consolidationError.value = 'Network error'
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="consolidation-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="retry-btn"]').exists()).toBe(true)
  })

  it('retry button triggers new consolidation', async () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.consolidationError.value = 'Network error'
    const wrapper = mount(ShoppingListPage, mountOptions)
    await wrapper.find('[data-testid="retry-btn"]').trigger('click')
    expect(consolidatedState.consolidate).toHaveBeenCalled()
  })

  it('retry available on baseline_fallback', async () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'baseline_fallback'
    consolidatedState.baselineLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]
    consolidatedState.warnings.value = ['AI polish failed']
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="retry-btn"]').exists()).toBe(true)
    await wrapper.find('[data-testid="retry-btn"]').trigger('click')
    expect(consolidatedState.consolidate).toHaveBeenCalled()
  })
})

describe('shopping-list page: return to recipe sections', () => {
  it('recipe sections still render correctly after returning from consolidated view', async () => {
    setupGlobals({ plan: 'plan-1' }, {
      planLoaded: true,
      sections: [{ recipeId: 'r1', recipeTitle: 'Pasta', occurrenceCount: 2, ingredients: [{ rawText: '400 g pasta', name: 'pasta', quantity: 400, unit: 'g' }] }],
    })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).toContain('Pasta')
    expect(wrapper.text()).toContain('× 2')
  })

  it('occurrence badges in recipe sections are unchanged by consolidation', () => {
    setupGlobals({ plan: 'plan-1' }, {
      planLoaded: true,
      sections: [{ recipeId: 'r1', recipeTitle: 'Pasta', occurrenceCount: 3, ingredients: [] }],
    })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).toContain('× 3')
  })
})
