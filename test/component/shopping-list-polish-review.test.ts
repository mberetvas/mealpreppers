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
    saving: ref(false),
    saveError: ref<string | null>(null),
    updateReviewLine: vi.fn(),
    confirmReview: vi.fn(),
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

describe('shopping-list page: polish review entry', () => {
  it('transitions to review when polishStatus is pending_review', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'pending_review'
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'tomaten', quantity: 600, unit: 'g', provenance: [] },
    ]
    consolidatedState.reviewLines.value = [
      { id: 'L1', name: 'tomaten', quantity: 600, unit: 'g', provenance: [] },
    ]
    consolidatedState.hints.value = [
      { lineId: 'L1', rule: 'quantity-cap', severity: 'error', message: 'Exceeds cap' },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="polish-review"]').exists()).toBe(true)
  })

  it('shows save error banner during review when persistence failed', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'pending_review'
    consolidatedState.reviewLines.value = [
      { id: 'L1', name: 'tomaten', quantity: 600, unit: 'g', provenance: [] },
    ]
    consolidatedState.saveError.value = 'Could not save the shopping list.'

    const wrapper = mount(ShoppingListPage, mountOptions)
    const banner = wrapper.find('[data-testid="save-error"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('Could not save the shopping list.')
    expect(wrapper.find('[data-testid="polish-review"]').exists()).toBe(true)
  })

  it('does NOT show review when polishStatus is polished', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="polish-review"]').exists()).toBe(false)
  })

  it('does NOT show review when polishStatus is baseline_fallback', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'baseline_fallback'
    consolidatedState.baselineLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]
    consolidatedState.warnings.value = ['AI polish timed out']

    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="polish-review"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="fallback-banner"]').exists()).toBe(true)
  })
})

describe('shopping-list page: polish review confirm → consolidated display', () => {
  it('after confirmReview, shows consolidated display (not review)', async () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'pending_review'
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'tomaten', quantity: 400, unit: 'g', provenance: [] },
    ]
    consolidatedState.reviewLines.value = [
      { id: 'L1', name: 'tomaten', quantity: 400, unit: 'g', provenance: [] },
    ]
    consolidatedState.hints.value = []

    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="polish-review"]').exists()).toBe(true)

    // Simulate what confirmReview would do: change polishStatus to polished
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.reviewLines.value = []
    consolidatedState.hints.value = []
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="polish-review"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('tomaten')
  })
})

describe('shopping-list page: baseline-only fallback still shows warning UX', () => {
  it('baseline_fallback shows warning banner without entering review', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'baseline_fallback'
    consolidatedState.baselineLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]
    consolidatedState.warnings.value = ['AI polish timed out; returning baseline.']

    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="fallback-banner"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="polish-review"]').exists()).toBe(false)
  })

  it('ai_skipped shows warning banner without entering review', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'ai_skipped'
    consolidatedState.baselineLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]
    consolidatedState.warnings.value = ['AI polish was skipped.']

    const wrapper = mount(ShoppingListPage, mountOptions)
    expect(wrapper.find('[data-testid="ai-skipped-banner"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="polish-review"]').exists()).toBe(false)
  })
})
