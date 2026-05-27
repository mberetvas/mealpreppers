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
    planName: ref(overrides.planName ?? ''),
    sections: ref(overrides.sections ?? []),
    planLoaded: ref(overrides.planLoaded ?? false),
    planError: ref(overrides.planError ?? false),
    failedRecipeCount: ref(overrides.failedRecipeCount ?? 0),
    load: vi.fn(),
  }

  const consolidatedState = {
    consolidating: ref(false),
    consolidatedLines: ref([]),
    consolidationError: ref(null),
    polishStatus: ref(null),
    warnings: ref([]),
    baselineLines: ref([]),
    hasConsolidated: ref(false),
    savedListHydrationSettled: ref(true),
    consolidate: vi.fn(),
    reset: vi.fn(),
  }

  vi.stubGlobal('useRoute', () => ({ query }))
  vi.stubGlobal('useRouter', () => ({ replace: vi.fn() }))
  vi.stubGlobal('useHead', vi.fn())
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('useShoppingList', () => state)
  vi.stubGlobal('useConsolidatedShoppingList', () => consolidatedState)
  vi.stubGlobal('formatShoppingListIngredient', formatShoppingListIngredient)

  return state
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('shopping-list page: no ?plan= query parameter', () => {
  it('renders a "No plan selected" heading', () => {
    setupGlobals({}, { planError: true })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).toContain('No plan selected')
  })

  it('renders a link to /saved-weekplans with contextual text', () => {
    setupGlobals({}, { planError: true })
    const wrapper = mount(ShoppingListPage, mountOptions)

    const links = wrapper.findAllComponents({ name: 'NuxtLink' })
    const savedPlansLink = links.find(l => l.props('to') === '/saved-weekplans')
    expect(savedPlansLink).toBeDefined()
  })

  it('does NOT show the access failure heading "Plan could not be loaded"', () => {
    setupGlobals({}, { planError: true })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).not.toContain('Plan could not be loaded')
  })
})

describe('shopping-list page: plan access failure (non-empty planId)', () => {
  it('renders "Plan could not be loaded" heading', () => {
    setupGlobals({ plan: 'some-plan-id' }, { planError: true })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).toContain('Plan could not be loaded')
  })

  it('does NOT show "No plan selected"', () => {
    setupGlobals({ plan: 'some-plan-id' }, { planError: true })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).not.toContain('No plan selected')
  })
})

describe('shopping-list page: total recipe-resolution failure', () => {
  it('shows total-failure-specific banner when sections.length === 0 and failedRecipeCount > 0', () => {
    setupGlobals({ plan: 'plan-1' }, { planLoaded: true, sections: [], failedRecipeCount: 3 })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).toContain('Could not load any recipes for this plan')
  })

  it('does NOT use the partial-failure "may be incomplete" wording', () => {
    setupGlobals({ plan: 'plan-1' }, { planLoaded: true, sections: [], failedRecipeCount: 3 })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).not.toContain('may be incomplete')
  })
})

describe('shopping-list page: partial recipe-resolution failure', () => {
  it('shows "may be incomplete" banner when sections.length > 0 and failedRecipeCount > 0', () => {
    setupGlobals({ plan: 'plan-1' }, {
      planLoaded: true,
      sections: [{ recipeId: 'r1', recipeTitle: 'Pasta', occurrenceCount: 1, ingredients: [] }],
      failedRecipeCount: 1,
    })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).toContain('may be incomplete')
  })

  it('does NOT show total-failure copy', () => {
    setupGlobals({ plan: 'plan-1' }, {
      planLoaded: true,
      sections: [{ recipeId: 'r1', recipeTitle: 'Pasta', occurrenceCount: 1, ingredients: [] }],
      failedRecipeCount: 1,
    })
    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.text()).not.toContain('Could not load any recipes for this plan')
  })
})
