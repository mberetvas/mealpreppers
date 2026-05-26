/**
 * Component tests for Edit saved consolidated shopping list (issue #031).
 * Covers: Edit list button visibility, edit flow opening polish review,
 * and edit → change line → confirm → persisted display.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed, nextTick } from 'vue'
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
    savedList: ref<unknown>(null),
    loadSavedList: vi.fn(),
    editSaved: vi.fn(),
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

describe('shopping-list page: Edit list button visibility', () => {
  it('shows Edit list button when hasSavedShoppingList and not deprecated', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.shoppingListDeprecated.value = false
    consolidatedState.savedList.value = {
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
      sourceFingerprint: 'fp-123',
      confirmedAt: '2026-05-26T10:00:00.000Z',
    }
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)

    expect(wrapper.find('[data-testid="edit-saved-btn"]').exists()).toBe(true)
  })

  it('hides Edit list button when deprecated', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.shoppingListDeprecated.value = true
    consolidatedState.savedList.value = {
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
      sourceFingerprint: 'fp-123',
      confirmedAt: '2026-05-26T10:00:00.000Z',
    }
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)

    expect(wrapper.find('[data-testid="edit-saved-btn"]').exists()).toBe(false)
  })

  it('hides Edit list button when no saved list', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.shoppingListDeprecated.value = false
    consolidatedState.savedList.value = null
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)

    expect(wrapper.find('[data-testid="edit-saved-btn"]').exists()).toBe(false)
  })
})

describe('shopping-list page: Edit list button triggers editSaved', () => {
  it('clicking Edit list calls editSaved', async () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.shoppingListDeprecated.value = false
    consolidatedState.savedList.value = {
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
      sourceFingerprint: 'fp-123',
      confirmedAt: '2026-05-26T10:00:00.000Z',
    }
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)
    await wrapper.find('[data-testid="edit-saved-btn"]').trigger('click')

    expect(consolidatedState.editSaved).toHaveBeenCalled()
  })
})

describe('shopping-list page: edit → change line → confirm → persisted display', () => {
  it('shows polish review after editSaved is invoked', () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'pending_review'
    consolidatedState.shoppingListDeprecated.value = false
    consolidatedState.savedList.value = {
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
      sourceFingerprint: 'fp-123',
      confirmedAt: '2026-05-26T10:00:00.000Z',
    }
    consolidatedState.reviewLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]
    consolidatedState.baselineLines.value = [
      { id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)

    expect(wrapper.find('[data-testid="polish-review"]').exists()).toBe(true)
  })

  it('displays updated lines after confirm resolves', async () => {
    const { consolidatedState } = setupGlobals({ plan: 'plan-1', view: 'consolidated' })
    consolidatedState.hasConsolidated.value = true
    consolidatedState.polishStatus.value = 'polished'
    consolidatedState.shoppingListDeprecated.value = false
    consolidatedState.savedList.value = {
      lines: [{ id: 'L1', name: 'fusilli', quantity: 500, unit: 'g' }],
      sourceFingerprint: 'fp-new',
      confirmedAt: '2026-05-26T14:00:00.000Z',
    }
    consolidatedState.consolidatedLines.value = [
      { id: 'L1', name: 'fusilli', quantity: 500, unit: 'g', provenance: [] },
    ]

    const wrapper = mount(ShoppingListPage, mountOptions)

    // Post-confirm state shows updated lines
    expect(wrapper.text()).toContain('fusilli')
  })
})
