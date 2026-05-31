/**
 * Component tests: "View shopping list" action on the manage-plans page.
 *
 * Acceptance criteria covered:
 * - Action present on every card regardless of list status (AC #1)
 * - Clicking opens ConsolidatedShoppingListPreview for the correct plan (AC #3)
 * - Existing shopping-list direct link is preserved (AC #4)
 * - Preview modal receives flags matching the plan's state (AC #5)
 * - All three modal states (ready, outdated, no-list) reachable (AC #6)
 */
import { defineComponent, h, Suspense, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import SavedWeekplansPage from '../../app/pages/saved-weekplans.vue'

/** Stub that exposes received props via data-attributes so tests can assert them. */
const PreviewStub = {
  name: 'ShoppingListConsolidatedShoppingListPreview',
  props: ['planId', 'hasSavedShoppingList', 'shoppingListDeprecated', 'open'],
  emits: ['update:open'],
  template: `<div
    v-if="open"
    data-testid="preview-modal-stub"
    :data-plan-id="planId"
    :data-has-saved="String(hasSavedShoppingList)"
    :data-deprecated="String(shoppingListDeprecated)"
  />`,
}

const mountOptions = {
  global: {
    stubs: {
      NuxtLink: { name: 'NuxtLink', props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' },
      ShoppingListWeekplanConsolidatedListStatus: { template: '<span />' },
      ShoppingListConsolidatedShoppingListPreview: PreviewStub,
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

// ---------------------------------------------------------------------------
// Action presence on cards (regardless of list status)
// ---------------------------------------------------------------------------

describe('saved-weekplans page: View shopping list action on cards', () => {
  it('renders a "View shopping list" button on a card with no list yet', async () => {
    const wrapper = await mountPage([
      makeItem({ id: 'p1', hasSavedShoppingList: false, shoppingListDeprecated: false }),
    ])
    expect(wrapper.find('[data-testid="view-shopping-list-btn"]').exists()).toBe(true)
  })

  it('renders a "View shopping list" button on a card with a ready list', async () => {
    const wrapper = await mountPage([
      makeItem({ id: 'p1', hasSavedShoppingList: true, shoppingListDeprecated: false }),
    ])
    expect(wrapper.find('[data-testid="view-shopping-list-btn"]').exists()).toBe(true)
  })

  it('renders a "View shopping list" button on a card with an outdated list', async () => {
    const wrapper = await mountPage([
      makeItem({ id: 'p1', hasSavedShoppingList: true, shoppingListDeprecated: true }),
    ])
    expect(wrapper.find('[data-testid="view-shopping-list-btn"]').exists()).toBe(true)
  })

  it('renders one "View shopping list" button per card', async () => {
    const wrapper = await mountPage([
      makeItem({ id: 'p1', hasSavedShoppingList: false }),
      makeItem({ id: 'p2', hasSavedShoppingList: true, shoppingListDeprecated: false }),
      makeItem({ id: 'p3', hasSavedShoppingList: true, shoppingListDeprecated: true }),
    ])
    expect(wrapper.findAll('[data-testid="view-shopping-list-btn"]')).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// Existing direct link to full shopping-list page is preserved
// ---------------------------------------------------------------------------

describe('saved-weekplans page: existing shopping-cart link preserved', () => {
  it('still renders the direct shopping-list NuxtLink for each card', async () => {
    const wrapper = await mountPage([
      makeItem({ id: 'p1' }),
      makeItem({ id: 'p2' }),
    ])
    const links = wrapper.findAll('a[data-to]')
    const cartLinks = links.filter((l) => {
      const to = JSON.parse(l.attributes('data-to') ?? '{}')
      return to?.path === '/shopping-list'
    })
    expect(cartLinks).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Clicking the button opens the preview modal for the correct plan
// ---------------------------------------------------------------------------

describe('saved-weekplans page: clicking View shopping list opens preview modal', () => {
  it('opens preview modal with the correct planId after clicking the button', async () => {
    const wrapper = await mountPage([
      makeItem({ id: 'plan-xyz', hasSavedShoppingList: true, shoppingListDeprecated: false }),
    ])
    expect(wrapper.find('[data-testid="preview-modal-stub"]').exists()).toBe(false)

    await wrapper.find('[data-testid="view-shopping-list-btn"]').trigger('click')
    await flushPromises()

    const modal = wrapper.find('[data-testid="preview-modal-stub"]')
    expect(modal.exists()).toBe(true)
    expect(modal.attributes('data-plan-id')).toBe('plan-xyz')
  })

  it('opens preview for the clicked card, not another card', async () => {
    const wrapper = await mountPage([
      makeItem({ id: 'first-plan', hasSavedShoppingList: false }),
      makeItem({ id: 'second-plan', hasSavedShoppingList: true, shoppingListDeprecated: false }),
    ])
    const buttons = wrapper.findAll('[data-testid="view-shopping-list-btn"]')
    await buttons[1]!.trigger('click')
    await flushPromises()

    const modal = wrapper.find('[data-testid="preview-modal-stub"]')
    expect(modal.attributes('data-plan-id')).toBe('second-plan')
  })
})

// ---------------------------------------------------------------------------
// All three modal states reachable (flags correctly forwarded)
// ---------------------------------------------------------------------------

describe('saved-weekplans page: all three modal states reachable', () => {
  it('forwards hasSavedShoppingList=false so modal shows no-list state', async () => {
    const wrapper = await mountPage([
      makeItem({ id: 'p1', hasSavedShoppingList: false, shoppingListDeprecated: false }),
    ])
    await wrapper.find('[data-testid="view-shopping-list-btn"]').trigger('click')
    await flushPromises()

    const modal = wrapper.find('[data-testid="preview-modal-stub"]')
    expect(modal.attributes('data-has-saved')).toBe('false')
    expect(modal.attributes('data-deprecated')).toBe('false')
  })

  it('forwards hasSavedShoppingList=true, deprecated=false so modal shows ready state', async () => {
    const wrapper = await mountPage([
      makeItem({ id: 'p1', hasSavedShoppingList: true, shoppingListDeprecated: false }),
    ])
    await wrapper.find('[data-testid="view-shopping-list-btn"]').trigger('click')
    await flushPromises()

    const modal = wrapper.find('[data-testid="preview-modal-stub"]')
    expect(modal.attributes('data-has-saved')).toBe('true')
    expect(modal.attributes('data-deprecated')).toBe('false')
  })

  it('forwards hasSavedShoppingList=true, deprecated=true so modal shows outdated state', async () => {
    const wrapper = await mountPage([
      makeItem({ id: 'p1', hasSavedShoppingList: true, shoppingListDeprecated: true }),
    ])
    await wrapper.find('[data-testid="view-shopping-list-btn"]').trigger('click')
    await flushPromises()

    const modal = wrapper.find('[data-testid="preview-modal-stub"]')
    expect(modal.attributes('data-has-saved')).toBe('true')
    expect(modal.attributes('data-deprecated')).toBe('true')
  })
})
