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
    shoppingListDeprecated: ref(false),
    savedListHydrationSettled: ref(true),
    savedList: ref<unknown>(null),
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

describe('shopping-list page: polish diff — lines changed by AI', () => {
  it('marks lines that differ from baseline with a diff indicator', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.baselineLines.value = [
      { id: 'L1', name: 'tomaten', quantity: 400, unit: 'g', provenance: [] },
      { id: 'L2', name: 'olijfolie', quantity: 2, unit: 'el', provenance: [] },
    ]
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'cherry tomaten', quantity: 400, unit: 'g', provenance: [] },
      { id: 'L2', name: 'olijfolie', quantity: 2, unit: 'el', provenance: [] },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)
    const diffLines = wrapper.findAll('[data-testid="diff-changed"]')
    expect(diffLines.length).toBe(1)
    expect(diffLines[0].text()).toContain('cherry tomaten')
  })

  it('does not mark lines that are unchanged from baseline', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.baselineLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.findAll('[data-testid="diff-changed"]').length).toBe(0)
  })

  it('marks lines with quantity changes as diff', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.baselineLines.value = [
      { id: 'L1', name: 'pasta', quantity: 400, unit: 'g', provenance: [] },
    ]
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.findAll('[data-testid="diff-changed"]').length).toBe(1)
  })

  it('marks lines with unit changes as diff', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.baselineLines.value = [
      { id: 'L1', name: 'melk', quantity: 500, unit: 'ml', provenance: [] },
    ]
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'melk', quantity: 500, unit: 'l', provenance: [] },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.findAll('[data-testid="diff-changed"]').length).toBe(1)
  })

  it('marks new lines (not in baseline) as diff', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.baselineLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
      { id: 'L3', name: 'tomaten (samengevoegd)', quantity: 600, unit: 'g', provenance: [] },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)
    const diffLines = wrapper.findAll('[data-testid="diff-changed"]')
    expect(diffLines.length).toBe(1)
    expect(diffLines[0].text()).toContain('tomaten (samengevoegd)')
  })
})

describe('shopping-list page: polish diff — changes explanations', () => {
  it('renders changes explanations when present', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.baselineLines.value = [
      { id: 'L1', name: 'tomaten', quantity: 400, unit: 'g', provenance: [] },
      { id: 'L2', name: 'cherrytomaten', quantity: 200, unit: 'g', provenance: [] },
    ]
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'tomaten (alle soorten)', quantity: 600, unit: 'g', provenance: [] },
    ]
    consolidatedState.changes.value = [
      { id: 'L1', reason: "merged 'tomaten' and 'cherrytomaten'" },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)
    const changesSection = wrapper.find('[data-testid="polish-changes"]')
    expect(changesSection.exists()).toBe(true)
    expect(changesSection.text()).toContain("merged 'tomaten' and 'cherrytomaten'")
  })

  it('does not render changes section when changes array is empty', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.baselineLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]
    consolidatedState.changes.value = []

    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="polish-changes"]').exists()).toBe(false)
  })

  it('does not render changes section when changes is absent (undefined-like)', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.baselineLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]
    // changes stays as default empty array from ref initialization

    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="polish-changes"]').exists()).toBe(false)
  })
})

describe('shopping-list page: polish diff — no-diff states', () => {
  it('shows no diff indicators when polishStatus is baseline_fallback', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'baseline_fallback'
    consolidatedState.baselineLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'polished pasta', quantity: 800, unit: 'g', provenance: [] },
    ]
    consolidatedState.warnings.value = ['AI polish output rejected']

    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.findAll('[data-testid="diff-changed"]').length).toBe(0)
    expect(wrapper.find('[data-testid="polish-changes"]').exists()).toBe(false)
  })

  it('shows no diff indicators when polishStatus is ai_skipped', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'ai_skipped'
    consolidatedState.baselineLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]
    consolidatedState.warnings.value = ['AI polish was skipped']

    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.findAll('[data-testid="diff-changed"]').length).toBe(0)
    expect(wrapper.find('[data-testid="polish-changes"]').exists()).toBe(false)
  })

  it('shows no diff indicators when consolidated lines exactly match baseline', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.baselineLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
      { id: 'L2', name: 'olijfolie', quantity: 2, unit: 'el', provenance: [] },
    ]
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
      { id: 'L2', name: 'olijfolie', quantity: 2, unit: 'el', provenance: [] },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.findAll('[data-testid="diff-changed"]').length).toBe(0)
    expect(wrapper.find('[data-testid="polish-changes"]').exists()).toBe(false)
  })
})
