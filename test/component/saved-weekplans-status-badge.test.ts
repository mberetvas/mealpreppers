/**
 * Integration tests: WeekplanConsolidatedListStatus badge in the manage-plans page.
 * Covers all three badge states rendered on each plan card.
 */
import { defineComponent, h, Suspense, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import SavedWeekplansPage from '../../app/pages/saved-weekplans.vue'
import WeekplanConsolidatedListStatus from '../../app/components/shopping-list/WeekplanConsolidatedListStatus.vue'

const mountOptions = {
  global: {
    components: {
      // Register the real component so badge text renders in page tests
      ShoppingListWeekplanConsolidatedListStatus: WeekplanConsolidatedListStatus,
    },
    stubs: {
      NuxtLink: { name: 'NuxtLink', props: ['to'], template: '<a><slot /></a>' },
    },
  },
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-1',
    name: 'Test Plan',
    updatedAt: new Date().toISOString(),
    hasSavedShoppingList: false,
    shoppingListDeprecated: false,
    ...overrides,
  }
}

function setupGlobals(items: ReturnType<typeof makeItem>[]) {
  vi.stubGlobal('useFetch', vi.fn(() => ({
    data: ref(items),
    pending: ref(false),
    error: ref(null),
    refresh: vi.fn().mockResolvedValue(undefined),
  })))
  vi.stubGlobal('useHead', vi.fn())
  vi.stubGlobal('useAccessibleOverlayInteraction', vi.fn())
  vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))
}

async function mountPage(items: ReturnType<typeof makeItem>[]) {
  setupGlobals(items)
  const wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(SavedWeekplansPage) }) }),
    mountOptions,
  )
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('saved-weekplans page: WeekplanConsolidatedListStatus badge', () => {
  it('renders "List ready" badge for a plan with a valid saved shopping list', async () => {
    const wrapper = await mountPage([
      makeItem({ hasSavedShoppingList: true, shoppingListDeprecated: false }),
    ])
    expect(wrapper.text()).toContain('List ready')
  })

  it('renders "List outdated" badge for a plan with a deprecated shopping list', async () => {
    const wrapper = await mountPage([
      makeItem({ hasSavedShoppingList: true, shoppingListDeprecated: true }),
    ])
    expect(wrapper.text()).toContain('List outdated')
  })

  it('renders "No list yet" badge for a plan without a saved shopping list', async () => {
    const wrapper = await mountPage([
      makeItem({ hasSavedShoppingList: false, shoppingListDeprecated: false }),
    ])
    expect(wrapper.text()).toContain('No list yet')
  })

  it('renders one badge per plan card', async () => {
    const wrapper = await mountPage([
      makeItem({ id: 'p1', hasSavedShoppingList: true, shoppingListDeprecated: false }),
      makeItem({ id: 'p2', hasSavedShoppingList: false }),
      makeItem({ id: 'p3', hasSavedShoppingList: true, shoppingListDeprecated: true }),
    ])
    expect(wrapper.text()).toContain('List ready')
    expect(wrapper.text()).toContain('No list yet')
    expect(wrapper.text()).toContain('List outdated')
  })
})
